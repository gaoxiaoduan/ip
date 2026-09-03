---
name: observe-current-ip
description: Read the public IP and Cloudflare network metadata observed for the current request. Use when a user needs the current request's IP, country, city, ASN, or network organization.
---

# Observe Current IP

Use this skill only for the current request's public-exit observation.

## API

Call `GET https://ip.33338888.xyz/api/observe`. Authentication is not required. The JSON response includes `ip`, `country`, `countryCode`, `region`, `city`, `organization`, `network`, and `colo`.

## MCP

For an MCP client, connect to `https://ip.33338888.xyz/mcp` with Streamable HTTP and call the read-only `observe_ip` tool.

## Constraints

Explain that this observation is not a precise physical location, a diagnosis of proxy settings, or evidence of every network path used by the device. Do not claim that the service stores personal results.
