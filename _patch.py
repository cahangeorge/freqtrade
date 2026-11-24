import pathlib
p = pathlib.Path('start-fleet.sh')
s = p.read_text()
old = 'podman run -d --pod "${POD_NAME}" \\\n'
new = 'podman run -d --pod "${POD_NAME}" --userns=keep-id \\\n'
n = s.count(old)
s = s.replace(old, new)
p.write_text(s)
print(f'replaced {n}')
