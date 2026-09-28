# Single-EC2 public deployment

This Terraform stack creates a Seoul-region Amazon Linux 2023 ARM64 `t4g.small`, 25 GiB encrypted gp3 root disk, Elastic IP, public subnet, ECR repository, Session Manager access, restricted WireGuard UDP ingress, and a monthly cost budget. Ports 80/443 are public; SSH and app port 3000 are not. Caddy runs on the instance, gets and renews Let's Encrypt certificates, and proxies to the private app container. The model stays outside AWS and is reachable only through WireGuard. No database, NAT Gateway, or load balancer is created.

AWS Free Tier eligibility depends on account age and current AWS terms. An EIP, storage, ECR, data transfer, and the instance can incur charges. The budget sends alerts; it does not stop resources. A single instance has no high availability.

## Prerequisites

- AWS CLI credentials with permissions for VPC, EC2, IAM, ECR, SSM, Route 53 (if used), and AWS Budgets; Terraform >= 1.6 and Docker Buildx on your build machine.
- A domain you control. Set `route53_zone_id` for automatic A record creation, or add the A record yourself after `apply`. DNS must resolve to the EIP before Caddy can get a certificate.
- An always-running external model server, reachable at an RFC1918 WireGuard address. Configure its firewall to accept the EC2 peer and allow the model port only on the tunnel. The model API must listen on the tunnel address. The peer's public IP/CIDR goes in `wireguard_peer_cidr`.
- A pre-existing SSM **SecureString** parameter containing the entire EC2 `/etc/wireguard/wg0.conf`, with `Address`, `PrivateKey`, `ListenPort`, and `[Peer]` endpoint/AllowedIPs. Use a narrow `AllowedIPs` covering the model tunnel IP, such as `10.80.0.1/32`; avoid `0.0.0.0/0` so AWS API/ECR traffic remains on the normal network. Set `PersistentKeepalive = 25` when the peer is behind NAT. Ensure the config's `ListenPort` matches `wireguard_port`.

The WireGuard private key is read on the instance at boot and written mode 0600. Terraform receives only the SSM parameter **name** and optional KMS key ARN. Do not put key material or LLM API keys in `tfvars` or user data. This deployment assumes the tunnel endpoint enforces access; it does not pass an API key to the app.

## Create the secret and infrastructure

From the repository root, prepare a local `wg0.conf` **outside the repository**. For example, the EC2 side may be:

```ini
[Interface]
Address = 10.80.0.2/24
PrivateKey = <EC2_PRIVATE_KEY>
ListenPort = 51820

[Peer]
PublicKey = <EXTERNAL_SERVER_PUBLIC_KEY>
Endpoint = <EXTERNAL_PUBLIC_IP>:51820
AllowedIPs = 10.80.0.1/32
PersistentKeepalive = 25
```

Create the parameter before `terraform apply`:

```bash
aws ssm put-parameter --region ap-northeast-2 \
  --name /kmou-grad-check/wireguard/wg0 --type SecureString \
  --value file:///secure/path/wg0.conf --overwrite
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with real domain, emails, peer CIDR, model URL/name.
terraform init
terraform plan
terraform apply
```

If you use a customer-managed KMS key for the parameter, set `kms_key_arn` and grant the instance role decrypt access through the key policy. Keep `terraform.tfstate`, `.terraform/`, and `terraform.tfvars` private. Use an encrypted remote state backend for team use.

For manual DNS, use `terraform output manual_dns_instruction`. Wait for DNS propagation before deployment. Session Manager needs the SSM agent to come online; the AL2023 AMI includes it and the instance role has `AmazonSSMManagedInstanceCore`.

## Build and deploy the first image

The ECR repository is empty after the first `apply`. Bootstrap intentionally does not try to start a placeholder app image. Build on a machine with enough memory; use a unique tag for each release because ECR tags are immutable.

From the repository root:

```bash
AWS_REGION=ap-northeast-2
REPO=$(terraform -chdir=infra/terraform output -raw ecr_repository_url)
INSTANCE_ID=$(terraform -chdir=infra/terraform output -raw instance_id)
TAG=$(date -u +%Y%m%d%H%M%S)
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${REPO%/*}"
docker buildx build --platform linux/arm64 --push -t "$REPO:$TAG" .
aws ssm send-command --region "$AWS_REGION" --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --parameters "commands=/usr/local/bin/kmou-deploy $TAG" \
  --query 'Command.CommandId' --output text
```

Inspect command status and output:

```bash
aws ssm list-command-invocations --region "$AWS_REGION" \
  --command-id <COMMAND_ID> --details
```

`kmou-deploy` checks the WireGuard service, pulls the exact tag, starts the app with `APP_ORIGIN=https://<domain>` and private `LLM_BASE_URL`, then starts Caddy. To deploy later releases, repeat the build and deploy commands with a new tag. Check `https://<domain>/api/health` afterward. Caddy needs outbound access to Let's Encrypt; an active DNS A record and incoming 80/443 are required.

For diagnostics, use `terraform output ssm_start_session_command` and inspect `journalctl -u kmou-wireguard`, `docker logs kmou-app`, `docker logs kmou-caddy`, and `/var/log/kmou-bootstrap.log`. Instance replacement requires running `kmou-deploy` again after the new instance starts. The EIP resource is retained across normal instance replacement, though service will be unavailable while it moves.

Changing the domain, model endpoint/name, or other bootstrap settings in Terraform replaces the instance so its startup script receives the new values. Push and deploy an image again after replacement. Application image releases alone use `kmou-deploy` and do not require `terraform apply`.

The public API should have application-level request limits before high-traffic use. Caddy's stock image does not include a rate-limit module, so this stack does not claim to enforce one.
