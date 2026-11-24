import pathlib
p = pathlib.Path('start-fleet.sh')
s = p.read_text()
s = s.replace('--pod "${POD_NAME}" --userns=keep-id \\', '--pod "${POD_NAME}" \\')
p.write_text(s)
print(s.count('--userns=keep-id'))
