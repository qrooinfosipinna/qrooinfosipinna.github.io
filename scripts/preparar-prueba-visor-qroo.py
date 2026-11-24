"""Recover cached published data for tests, never regenerate publication inputs."""
import json
from pathlib import Path
import posixpath
import re
import xml.etree.ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
RID = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'
items = []
for file in sorted((ROOT / 'data/INDICADORES INEGI/Quintana Roo').rglob('T_*.xlsx')):
    match = re.fullmatch(r'T_(.+)-(\d+)-(\d+)_QROO', file.stem)
    if not match:
        continue
    with ZipFile(file) as archive:
        workbook = ET.fromstring(archive.read('xl/workbook.xml'))
        sheet = next((s for s in workbook.findall('s:sheets/s:sheet', NS) if s.get('name') == 'Datos'), None)
        if sheet is None:
            continue
        rels = ET.fromstring(archive.read('xl/_rels/workbook.xml.rels'))
        target = next(r.get('Target') for r in rels if r.get('Id') == sheet.get(RID))
        target = target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/' + target)
        strings = []
        if 'xl/sharedStrings.xml' in archive.namelist():
            strings = [''.join(n.itertext()) for n in ET.fromstring(archive.read('xl/sharedStrings.xml'))]
        rows = []
        for row in ET.fromstring(archive.read(target)).findall('s:sheetData/s:row', NS)[1:]:
            values = {}
            for cell in row.findall('s:c', NS):
                column = re.match(r'[A-Z]+', cell.get('r')).group()
                value = cell.findtext('s:v', default='', namespaces=NS)
                if cell.get('t') == 's':
                    value = strings[int(value)]
                elif cell.get('t') == 'inlineStr':
                    value = ''.join(cell.find('s:is', NS).itertext())
                elif cell.get('t') in (None, 'n') and value:
                    value = float(value) if any(c in value.lower() for c in '.e') else int(value)
                values[column] = value
            if not values.get('A') or not values.get('B'):
                continue
            assert isinstance(values.get('C'), (float, int)), (file, values)
            rows.append([values.get(c, '') for c in 'ABCD'])
        theme, major, minor = match.groups()
        items.append({'tema': theme, 'id': major + '.' + minor,
                      'source': file.relative_to(ROOT).as_posix(), 'raw': rows,
                      'records': [{'value': r[2]} for r in rows]})
assert items and all(i['records'] for i in items)
output = ROOT / '.metrics/visor-insumo-publicado.json'
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(items, ensure_ascii=False), encoding='utf-8')
print(f'{len(items)} libros, {sum(len(i["raw"]) for i in items)} observaciones recuperadas para pruebas')
