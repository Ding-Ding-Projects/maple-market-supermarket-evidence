const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const SCRIPT = readFileSync(join(__dirname, '..', 'docs', 'copy-description.js'), 'utf8');

function createFixture({ secureContext = true, writeText }) {
  const source = {
    value: 'Reviewed bilingual game description',
    focusCalled: false,
    selectCalled: false,
    rangeCalled: false,
    focus() { this.focusCalled = true; },
    select() { this.selectCalled = true; },
    setSelectionRange() { this.rangeCalled = true; },
  };
  const button = {
    listener: null,
    addEventListener(name, listener) {
      assert.equal(name, 'click');
      this.listener = listener;
    },
  };
  const status = { textContent: 'Ready' };
  const context = {
    document: {
      getElementById(id) {
        return {
          'game-description-copy': source,
          'copy-game-description': button,
          'game-description-copy-status': status,
        }[id] || null;
      },
    },
    navigator: { clipboard: writeText ? { writeText } : undefined },
    window: { isSecureContext: secureContext },
  };
  vm.runInNewContext(SCRIPT, context);
  return { button, source, status };
}

test('copy reports success after clipboard resolution', async () => {
  let copiedText = null;
  const fixture = createFixture({
    writeText: async (value) => { copiedText = value; },
  });

  await fixture.button.listener();

  assert.equal(copiedText, fixture.source.value);
  assert.equal(fixture.status.textContent, 'Description copied. / 介紹已複製。');
  assert.equal(fixture.source.selectCalled, false);
});

test('copy selects text when clipboard access is unavailable', async () => {
  const fixture = createFixture({ secureContext: false });

  await fixture.button.listener();

  assert.equal(fixture.source.focusCalled, true);
  assert.equal(fixture.source.selectCalled, true);
  assert.equal(fixture.source.rangeCalled, true);
  assert.match(fixture.status.textContent, /^Clipboard unavailable\./);
});

test('copy selects text after a rejected clipboard promise', async () => {
  const fixture = createFixture({
    writeText: async () => { throw new Error('permission rejected'); },
  });

  await fixture.button.listener();

  assert.equal(fixture.source.selectCalled, true);
  assert.match(fixture.status.textContent, /^Clipboard unavailable\./);
});
