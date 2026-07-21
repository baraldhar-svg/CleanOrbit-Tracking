from pathlib import Path
root = Path('artifacts/api-server/src/routes')
updated = []
for path in root.glob('*.ts'):
    text = path.read_text(encoding='utf-8')
    new = text
    if 'import { Router } from "express";' in new:
        new = new.replace('import { Router } from "express";', 'import { Router, type IRouter } from "express";')
    if 'const router = Router();' in new:
        new = new.replace('const router = Router();', 'const router: IRouter = Router();')
    if new != text:
        path.write_text(new, encoding='utf-8')
        updated.append(path.name)
print('Updated', updated)