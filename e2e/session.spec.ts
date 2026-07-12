import { test, expect } from '@playwright/test';

function makeUIMessageStream(text: string): string {
  const textPartId = 'text-part-1';
  const chunks = [
    { type: 'start', messageId: `mock-msg-1` },
    { type: 'text-start', id: textPartId },
    { type: 'text-delta', id: textPartId, delta: text },
    { type: 'text-end', id: textPartId },
    { type: 'finish-step' },
    { type: 'finish', finishReason: 'stop' },
  ];
  return chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n';
}

async function mockChatRoute(page: import('@playwright/test').Page, getReply: () => string) {
  await page.route('/api/chat', async (route) => {
    const body = makeUIMessageStream(getReply());
    await route.fulfill({
      status: 200,
      contentType: 'text/plain; charset=utf-8',
      headers: { 'x-vercel-ai-ui-message-stream': 'v1' },
      body,
    });
  });
}

/** Wait until a session entry exists in the sidebar (delete button visible = session created). */
async function waitForSessionReady(page: import('@playwright/test').Page) {
  // The delete button aria-label includes "を削除" — only present when a session exists in the list
  await expect(page.locator('[aria-label*="を削除"]').first()).toBeVisible({ timeout: 15_000 });
}

/** Register a PUT /messages response listener BEFORE the action that triggers it. */
function waitForMessagesSaved(page: import('@playwright/test').Page) {
  return page.waitForResponse(
    (res) =>
      res.url().includes('/api/sessions/') &&
      res.url().includes('/messages') &&
      res.request().method() === 'PUT',
    { timeout: 30_000 },
  );
}

test.describe('セッション永続化', () => {
  test('会話後にリロードしても履歴が残っている', async ({ page }) => {
    const aiReply = 'Cコードは人差し指で1弦1フレット、中指で2弦2フレット、薬指で4弦3フレットを押さえます。';
    await mockChatRoute(page, () => aiReply);
    await page.goto('/');

    // Wait for the session entry (not the always-visible header button)
    await waitForSessionReady(page);

    // Register PUT listener BEFORE sending to avoid race condition
    const savedPromise = waitForMessagesSaved(page);

    const input = page.getByRole('textbox');
    await input.fill('Cコードの押さえ方を教えて');
    await input.press('Enter');

    await expect(page.getByText('Cコードの押さえ方を教えて')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Cコードは人差し指で/)).toBeVisible({ timeout: 15_000 });

    // Wait for save to complete
    await savedPromise;

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Use .last() to target the chat message (sidebar session title also matches after title update)
    await expect(page.getByText('Cコードの押さえ方を教えて').last()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Cコードは人差し指で/)).toBeVisible({ timeout: 5_000 });
  });

  test('セッションを追加しても各履歴が保持される', async ({ page }) => {
    let callCount = 0;
    const replies = ['Amコードはラマイナーコードです。', 'Emコードは最も簡単なコードの一つです。'];
    await mockChatRoute(page, () => replies[callCount++ % replies.length]);

    await page.goto('/');

    // Wait for the initial session entry before interacting
    await waitForSessionReady(page);

    const input = page.getByRole('textbox');

    // 1つ目のメッセージ
    const saved1 = waitForMessagesSaved(page);
    await input.fill('Amコードとは何ですか');
    await input.press('Enter');
    await expect(page.getByText('Amコードとは何ですか')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Amコードはラマイナーコードです/)).toBeVisible({ timeout: 15_000 });
    await saved1;

    // 新しいセッションを作成
    await page.getByRole('button', { name: /新しい会話/ }).first().click();
    // Wait for the new session entry to appear before sending the next message
    await expect(page.locator('[aria-label*="を削除"]')).toHaveCount(2, { timeout: 10_000 });

    // 2つ目のメッセージ
    const saved2 = waitForMessagesSaved(page);
    await input.fill('Emコードの運指を教えて');
    await input.press('Enter');
    await expect(page.getByText('Emコードの運指を教えて')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Emコードは最も簡単な/)).toBeVisible({ timeout: 15_000 });
    await saved2;

    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Emコードの運指を教えて').last()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Emコードは最も簡単な/)).toBeVisible({ timeout: 5_000 });
  });
});
