/**
 * Split text into chunks with overlap
 * @param {string} text - Text to chunk
 * @param {number} chunkSize - Size of each chunk in characters
 * @param {number} chunkOverlap - Overlap between chunks in characters
 * @returns {Array<{text: string, startIndex: number, endIndex: number}>}
 */
export const chunkText = (text, chunkSize = 1000, chunkOverlap = 200) => {
  if (!text || text.length === 0) {
    return [];
  }

  const chunks = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = Math.min(startIndex + chunkSize, text.length);
    let chunk = text.slice(startIndex, endIndex);

    // Try to break at sentence boundaries for better chunking
    if (endIndex < text.length) {
      // Look for sentence endings within the last 100 characters
      const lastPeriod = chunk.lastIndexOf(".");
      const lastNewline = chunk.lastIndexOf("\n");
      const lastBreak = Math.max(lastPeriod, lastNewline);

      if (lastBreak > chunk.length - 100 && lastBreak > 0) {
        chunk = chunk.slice(0, lastBreak + 1);
        endIndex = startIndex + lastBreak + 1;
      }
    }

    chunks.push({
      text: chunk.trim(),
      startIndex,
      endIndex,
    });

    // Move start index forward by chunkSize - overlap
    startIndex = endIndex - chunkOverlap;

    // Prevent infinite loop
    if (startIndex <= chunks[chunks.length - 1].startIndex) {
      startIndex = chunks[chunks.length - 1].endIndex;
    }
  }

  return chunks;
};

/**
 * Split text into chunks by paragraphs
 * @param {string} text - Text to chunk
 * @param {number} maxChunkSize - Maximum size of each chunk
 * @returns {Array<{text: string, startIndex: number, endIndex: number}>}
 */
export const chunkByParagraphs = (text, maxChunkSize = 1000) => {
  if (!text || text.length === 0) {
    return [];
  }

  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const chunks = [];
  let currentChunk = "";
  let startIndex = 0;

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();

    if (currentChunk.length + trimmedParagraph.length + 2 <= maxChunkSize) {
      // Add paragraph to current chunk
      if (currentChunk) {
        currentChunk += "\n\n" + trimmedParagraph;
      } else {
        currentChunk = trimmedParagraph;
      }
    } else {
      // Save current chunk and start new one
      if (currentChunk) {
        const endIndex = startIndex + currentChunk.length;
        chunks.push({
          text: currentChunk,
          startIndex,
          endIndex,
        });
        startIndex = endIndex + 2; // +2 for \n\n
      }

      // If paragraph is too large, split it
      if (trimmedParagraph.length > maxChunkSize) {
        const subChunks = chunkText(trimmedParagraph, maxChunkSize, 0);
        chunks.push(...subChunks);
        startIndex += trimmedParagraph.length + 2;
      } else {
        currentChunk = trimmedParagraph;
      }
    }
  }

  // Add remaining chunk
  if (currentChunk) {
    chunks.push({
      text: currentChunk,
      startIndex,
      endIndex: startIndex + currentChunk.length,
    });
  }

  return chunks;
};
