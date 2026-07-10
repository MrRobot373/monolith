import urllib.request
import json
import os

token = "386a7a987d4c948c89c3b17f92d8770d5f50bd37f893af3a"
url = "http://127.0.0.1:8787/workspace/ws_4921298a77c2/sessions/ses_0c6b0a7baffeVl3Wa7fkLa3jRE/messages"

req = urllib.request.Request(url)
req.add_header("Authorization", f"Bearer {token}")

try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        
        output_lines = []
        items = data.get("items", [])
        
        # Sort items by creation time if not sorted
        items.sort(key=lambda x: x.get("info", {}).get("time", {}).get("created", 0))
        
        for item in items:
            info = item.get("info", {})
            role = info.get("role", "unknown")
            created_at = info.get("time", {}).get("created", 0)
            
            output_lines.append(f"=== ROLE: {role.upper()} (created: {created_at}) ===")
            
            parts = item.get("parts", [])
            for part in parts:
                p_type = part.get("type", "unknown")
                output_lines.append(f"  PART TYPE: {p_type}")
                
                if p_type == "text":
                    text = part.get("text", "")
                    output_lines.append("  CONTENT:")
                    # Indent text content
                    for line in text.splitlines():
                        output_lines.append(f"    {line}")
                elif p_type == "tool-call":
                    name = part.get("name", "")
                    args = part.get("arguments", {})
                    output_lines.append(f"  TOOL CALL: {name}")
                    output_lines.append(f"    ARGS: {json.dumps(args, indent=2)}")
                elif p_type == "tool-result":
                    out_text = part.get("output", "")
                    output_lines.append("  TOOL RESULT:")
                    # Truncate long results for display, but keep first 1000 chars
                    lines = out_text.splitlines()
                    if len(lines) > 50:
                        output_lines.append(f"    [Output is long: {len(lines)} lines]")
                        output_lines.append("\n".join(f"    {l}" for l in lines[:30]))
                        output_lines.append("    ...")
                        output_lines.append("\n".join(f"    {l}" for l in lines[-10:]))
                    else:
                        for line in lines:
                            output_lines.append(f"    {line}")
                elif p_type == "step-finish":
                    reason = part.get("reason", "")
                    output_lines.append(f"  STEP FINISH: {reason}")
            output_lines.append("\n")
            
        with open("chat_dump.txt", "w", encoding="utf-8") as f:
            f.write("\n".join(output_lines))
        print("Success! Wrote chat_dump.txt")
except Exception as e:
    print("Error:", e)
