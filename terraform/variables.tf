variable "aws_region" {
  type    = string
  default = "ap-northeast-2"
}
variable "name" {
  type    = string
  default = "kmou-grad-check"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,30}$", var.name))
    error_message = "name must be 3-31 lowercase letters, digits, or hyphens and start with a letter."
  }
}
variable "domain_name" {
  type = string
  validation {
    condition     = can(regex("^[a-zA-Z0-9][a-zA-Z0-9.-]*\\.[a-zA-Z]{2,}$", var.domain_name))
    error_message = "Provide a public DNS name such as grad.example.com."
  }
}
variable "route53_zone_id" {
  type    = string
  default = null
}
variable "acme_email" {
  type = string
  validation {
    condition     = can(regex("^[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$", var.acme_email))
    error_message = "Provide an email address for Let's Encrypt."
  }
}
variable "budget_email" {
  type = string
  validation {
    condition     = can(regex("^[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$", var.budget_email))
    error_message = "Provide a budget notification email."
  }
}
variable "monthly_budget_usd" {
  type    = number
  default = 10
  validation {
    condition     = var.monthly_budget_usd > 0
    error_message = "Budget must be positive."
  }
}
variable "instance_type" {
  type    = string
  default = "t4g.small"
}
variable "root_volume_gb" {
  type    = number
  default = 25
  validation {
    condition     = var.root_volume_gb >= 20 && var.root_volume_gb <= 30
    error_message = "Root volume must be 20-30 GiB."
  }
}
variable "wireguard_config_parameter_name" {
  type        = string
  description = "Existing SSM SecureString parameter containing the complete wg0.conf; its VALUE is never passed to Terraform."
  validation {
    condition     = can(regex("^/[A-Za-z0-9_./-]+$", var.wireguard_config_parameter_name))
    error_message = "Use an absolute SSM parameter name with letters, digits, _, ., /, or -."
  }
}
variable "wireguard_peer_cidr" {
  type        = string
  description = "Public IPv4 /32 or narrow CIDR of the external WireGuard peer; ingress UDP is limited to this range."
  validation {
    condition     = can(cidrhost(var.wireguard_peer_cidr, 0)) && can(regex("^([0-9]{1,3}\\.){3}[0-9]{1,3}/(3[0-2]|[12]?[0-9])$", var.wireguard_peer_cidr))
    error_message = "Provide a valid IPv4 CIDR."
  }
}
variable "wireguard_port" {
  type    = number
  default = 51820
  validation {
    condition     = var.wireguard_port >= 1 && var.wireguard_port <= 65535
    error_message = "WireGuard port must be 1-65535."
  }
}
variable "llm_base_url" {
  type        = string
  description = "Private tunnel URL of the external model server, e.g. http://10.80.0.1:8080."
  validation {
    condition     = can(regex("^http://(10\\.|192\\.168\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.)[0-9.]+:[0-9]+$", var.llm_base_url))
    error_message = "LLM URL must be an HTTP URL on RFC1918 IPv4 with explicit port."
  }
}
variable "llm_large_base_url" {
  type    = string
  default = null
  validation {
    condition     = var.llm_large_base_url == null || can(regex("^http://(10\\.|192\\.168\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.)[0-9.]+:[0-9]+$", var.llm_large_base_url))
    error_message = "Large LLM URL must be an HTTP URL on RFC1918 IPv4 with explicit port."
  }
}
variable "llm_provider" {
  type    = string
  default = "openai-compatible"
  validation {
    condition     = contains(["openai-compatible", "ollama"], var.llm_provider)
    error_message = "Use openai-compatible or ollama."
  }
}
variable "llm_model" {
  type = string
  validation {
    condition     = can(regex("^[A-Za-z0-9._:/-]+$", var.llm_model))
    error_message = "Model name must use letters, digits, period, underscore, colon, slash, or hyphen."
  }
}
variable "llm_large_model" {
  type    = string
  default = ""
  validation {
    condition     = var.llm_large_model == "" || can(regex("^[A-Za-z0-9._:/-]+$", var.llm_large_model))
    error_message = "Large model name must use letters, digits, period, underscore, colon, slash, or hyphen."
  }
}
variable "kms_key_arn" {
  type        = string
  default     = null
  description = "KMS key ARN used by the existing SecureString, if customer managed."
}
