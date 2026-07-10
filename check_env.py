import psutil

for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
    try:
        if proc.info['pid'] == 1892:
            print("Process Name:", proc.info['name'])
            print("Cmdline:", proc.info['cmdline'])
            print("Environment:")
            env = proc.environ()
            for k in sorted(env.keys()):
                if "OPENWORK" in k or "TOKEN" in k:
                    print(f"  {k} = {env[k]}")
    except Exception as e:
        print("Error:", e)
