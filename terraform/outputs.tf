output "public_ip" { value = aws_eip.app.public_ip }
output "domain_name" { value = var.domain_name }
output "ecr_repository_url" { value = aws_ecr_repository.app.repository_url }
output "instance_id" { value = aws_instance.app.id }
output "manual_dns_instruction" {
  value = var.route53_zone_id == null ? "Create an A record for ${var.domain_name} pointing to ${aws_eip.app.public_ip}." : "Route 53 A record managed by Terraform."
}
output "ssm_start_session_command" {
  value = "aws ssm start-session --region ${var.aws_region} --target ${aws_instance.app.id}"
}
