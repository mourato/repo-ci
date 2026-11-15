const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');

// Execute the actual reusable-workflow scripts: callers check out their own
// repository, so the gate must not depend on a helper in repo-ci's checkout.
const workflow = readFileSync(join(__dirname, '../.github/workflows/opencode-review.yml'), 'utf8');
function scriptFor(name) {
  const step = workflow.split(`      - name: ${name}\n`)[1]?.split('\n      - ')[0];
  assert.ok(step, `Missing workflow step: ${name}`);
  const script = step.split('          script: |\n')[1];
  assert.ok(script, `Missing script: ${name}`);
  return script.split('\n').map(line => line.replace(/^            /, '')).join('\n');
}

const head = 'a'.repeat(40);
const runUrl = '/owner/project/actions/runs/42';
const summary = (counts = 'blocker=0 should=0 nit=0', sha = head) =>
  `REVIEW_SUMMARY head=${sha} round=1 ${counts}`;
const comment = (text = summary(), overrides = {}) => ({
  id: 101,
  user: { login: 'github-actions[bot]', type: 'Bot' },
  body: `## Standards\nNo findings.\n\n${text}\n\n[github run](${runUrl})`,
  ...overrides,
});

async function runGate(comments, before = '100') {
  const failures = [];
  const notices = [];
  const script = new (Object.getPrototypeOf(async function () {}).constructor)(
    'github', 'context', 'core', 'process', scriptFor('Check review result'),
  );
  await script({
    rest: { issues: { listComments: 'list-comments' } },
    paginate: async (route, params) => {
      assert.equal(route, 'list-comments');
      assert.equal(params.issue_number, 7);
      assert.equal(params.per_page, 100);
      return comments;
    },
  }, {
    repo: { owner: 'owner', repo: 'project' },
    runId: 42,
    payload: { pull_request: { number: 7, head: { sha: head } } },
  }, {
    setFailed: message => failures.push(message),
    notice: message => notices.push(message),
  }, { env: { REVIEW_COMMENT_BOUNDARY: before } });
  return { failures, notices };
}

test('a clean review or optional nits pass', async () => {
  for (const counts of ['blocker=0 should=0 nit=0', 'blocker=0 should=0 nit=4']) {
    const result = await runGate([comment(summary(counts))]);
    assert.deepEqual(result.failures, []);
    assert.equal(result.notices.length, 1);
  }
});

test('blocker and should findings fail the check', async () => {
  for (const counts of ['blocker=1 should=3 nit=1', 'blocker=0 should=1 nit=0']) {
    const result = await runGate([comment(summary(counts))]);
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0], /Review requires changes/);
  }
});

test('closure round passes after findings are resolved', async () => {
  const result = await runGate([
    comment(summary('blocker=1 should=3 nit=1'), { id: 99 }),
    comment(summary().replace('round=1', 'round=closure')),
  ]);
  assert.deepEqual(result.failures, []);
});

test('missing, malformed, ambiguous, or wrong-head summaries fail closed', async () => {
  for (const text of [
    'No summary',
    summary('blocker=-1 should=0 nit=0'),
    summary('blocker=0 should=unknown nit=0'),
    summary('blocker=0 should=0'),
    summary('blocker=0 should=0 nit=0 extra=1'),
    summary(undefined, 'b'.repeat(40)),
    `${summary()}\n${summary()}`,
  ]) {
    const result = await runGate([comment(text)]);
    assert.equal(result.failures.length, 1, text);
    assert.match(result.failures[0], /valid REVIEW_SUMMARY/);
  }
});

test('old runs, earlier attempts, human comments, and other bots cannot pass the check', async () => {
  for (const candidate of [
    comment(undefined, { id: 100 }),
    comment(undefined, { body: comment().body.replace('runs/42', 'runs/41') }),
    comment(undefined, { user: { login: 'owner', type: 'User' } }),
    comment(undefined, { user: { login: 'another[bot]', type: 'Bot' } }),
  ]) {
    const result = await runGate([candidate]);
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0], /exactly one review comment/);
  }
});

test('missing or multiple current-run comments fail closed', async () => {
  for (const comments of [[], [comment(), comment(undefined, { id: 102 })]]) {
    assert.equal((await runGate(comments)).failures.length, 1);
  }
});

test('GitHub API errors propagate instead of reporting a passing review', async () => {
  const script = new (Object.getPrototypeOf(async function () {}).constructor)(
    'github', 'context', 'core', 'process', scriptFor('Check review result'),
  );
  await assert.rejects(script({
    rest: { issues: { listComments: 'list-comments' } },
    paginate: async () => { throw new Error('API unavailable'); },
  }, {
    repo: { owner: 'owner', repo: 'project' }, runId: 42,
    payload: { pull_request: { number: 7, head: { sha: head } } },
  }, {}, { env: { REVIEW_COMMENT_BOUNDARY: '100' } }), /API unavailable/);
});

test('comment boundary is captured before OpenCode, including paginated comments', async () => {
  assert.ok(workflow.indexOf('- name: Record comment boundary') < workflow.indexOf('- name: Run opencode'));
  assert.ok(workflow.indexOf('- name: Check review result') > workflow.indexOf('- name: Run opencode'));
  const script = new (Object.getPrototypeOf(async function () {}).constructor)(
    'github', 'context', scriptFor('Record comment boundary'),
  );
  for (const [comments, expected] of [[[], 0], [[{ id: 100 }, { id: 250 }], 250]]) {
    const boundary = await script({
      rest: { issues: { listComments: 'list-comments' } },
      paginate: async () => comments,
    }, { repo: { owner: 'owner', repo: 'project' }, payload: { pull_request: { number: 7 } } });
    assert.equal(boundary, expected);
  }
});
