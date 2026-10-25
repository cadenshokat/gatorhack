// Round 9: the question the person sends to the AI assistant they use most. Its answer is pasted back into WebAble
// and broken down into a ReaderProfile (READER_MODEL, then Jev checks each point against the answer).
// It asks about patterns across past conversations, not just stored memory: what they ask to have re-explained,
// when they want more or less, the words they use easily, what they push back on.

export const AI_PROMPT = `I use a browser extension called WebAble that rewrites hard paragraphs on websites so they read the way I like things explained. Based on our past conversations and anything you remember about me, describe how I like things explained. Cover:

1. Topics and fields I know well, and the kinds of words I use comfortably.
2. Topics that are new to me, where I need plain words or terms explained.
3. Whether I usually ask for shorter answers or for more detail.
4. Whether I like steps, bullet points, examples, comparisons, or the direct answer first.
5. Explanations I pushed back on or asked you to redo, and why.
6. Anything else about how I read, for example if English isn't my first language or long paragraphs lose me.

Give short real examples from our conversations where you can. Describe how I like explanations, not personal details: leave out names, health information and money details. Plain text, under 400 words.`;

/** Where each button sends the question. ChatGPT and Claude open with the question filled in. */
export const AI_ASK_URLS: Readonly<Record<'ChatGPT' | 'Claude', string>> = Object.freeze({
  ChatGPT: `https://chatgpt.com/?q=${encodeURIComponent(AI_PROMPT)}`,
  Claude: `https://claude.ai/new?q=${encodeURIComponent(AI_PROMPT)}`,
});

/** The shortest pasted answer worth breaking down, and the longest one sent. */
export const AI_ANSWER_MIN_CHARS = 80;
export const AI_ANSWER_MAX_CHARS = 20_000;
