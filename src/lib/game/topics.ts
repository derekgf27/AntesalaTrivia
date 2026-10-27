export type TopicProgress = {
  name: string;
  /** 1-based index within the topic. 0 means the topic card is up. */
  number: number;
  total: number;
};

export function topicName(question: { topic?: string } | null | undefined): string {
  return question?.topic?.trim() ?? "";
}

export type TopicBlock = {
  name: string;
  start: number;
  end: number;
};

export function topicBlocks<T extends { topic?: string }>(questions: T[]): TopicBlock[] {
  const blocks: TopicBlock[] = [];
  questions.forEach((question, index) => {
    const name = topicName(question);
    const last = blocks[blocks.length - 1];
    if (last && last.name === name) {
      last.end = index + 1;
    } else {
      blocks.push({ name, start: index, end: index + 1 });
    }
  });
  return blocks;
}

export function hasTopicRounds<T extends { topic?: string }>(questions: T[]): boolean {
  return topicBlocks(questions).length > 1;
}

export function topicProgress<T extends { topic?: string }>(
  questions: T[],
  index: number,
): TopicProgress | null {
  if (index < 0 || index >= questions.length) return null;
  const blocks = topicBlocks(questions);
  const block = blocks.find((item) => index >= item.start && index < item.end);
  if (!block || (blocks.length < 2 && !block.name)) return null;
  return {
    name: block.name,
    number: index - block.start + 1,
    total: block.end - block.start,
  };
}

/** Name of the next topic when the following question starts a new round. */
export function nextTopicName<T extends { topic?: string }>(
  questions: T[],
  index: number,
): string | null {
  if (!hasTopicRounds(questions) || index < 0) return null;
  const next = index + 1;
  if (next >= questions.length) return null;
  const upcoming = topicName(questions[next]);
  if (upcoming === topicName(questions[index])) return null;
  return upcoming;
}
