
export const getBookSubjects = async (title: string): Promise<string[]> => {
  if (!title || title.length < 3) return [];
  
  try {
    // Clean title for better search results
    const cleanTitle = title
      .replace(/\.pdf$/i, '')
      .replace(/[_\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const response = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(cleanTitle)}&limit=1`);
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const doc = data.docs?.[0];
    
    if (!doc || !doc.subject) return [];
    
    // Return top 5 subjects
    return doc.subject.slice(0, 5);
  } catch (error) {
    console.warn("Open Library API fetch failed:", error);
    return [];
  }
};
