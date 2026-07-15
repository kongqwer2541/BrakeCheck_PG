import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function getCssProperty(source, selector, propertyName) {
  const selectorStart = source.indexOf(`${selector} {`);
  assert.notEqual(selectorStart, -1, `Missing selector: ${selector}`);

  const bodyStart = source.indexOf('{', selectorStart) + 1;
  const bodyEnd = source.indexOf('}', bodyStart);
  const declarations = source
    .slice(bodyStart, bodyEnd)
    .split(';')
    .map((line) => line.trim())
    .filter(Boolean);

  const declaration = declarations.find((line) => line.startsWith(`${propertyName}:`));
  assert.ok(declaration, `Missing property: ${selector} ${propertyName}`);

  return declaration.slice(propertyName.length + 1).trim();
}

test('dashboard status badge and cancel button keep text readable', () => {
  const source = readFileSync(new URL('./main.css', import.meta.url), 'utf8');

  assert.equal(getCssProperty(source, '.dashboard-status-badge', 'width'), 'fit-content');
  assert.equal(getCssProperty(source, '.dashboard-status-badge', 'min-width'), '96px');
  assert.equal(getCssProperty(source, '.dashboard-cancel-button', 'min-width'), '76px');
});
