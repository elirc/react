export function renderBoard(state, onClue) {
  const board = document.getElementById('board'); board.replaceChildren();
  if (!state.categories.length) { const empty = document.createElement('p'); empty.textContent = 'Your bank is empty. Add a category in the editor.'; board.append(empty); }
  for (const category of state.categories) {
    const column = document.createElement('section'); column.className = 'category';
    const heading = document.createElement('h2'); heading.textContent = category.name; column.append(heading);
    for (const question of category.questions) {
      const tile = document.createElement('button'); tile.className = 'tile'; tile.dataset.questionId = question.id;
      const used = state.usedQuestionIds.includes(question.id); tile.textContent = used ? 'Used' : String(question.points); tile.disabled = used;
      tile.setAttribute('aria-label', `${category.name}: ${question.points} points${used ? ', used' : ''}`); tile.addEventListener('click', () => onClue(question, category.name)); column.append(tile);
    }
    if (!category.questions.length) { const note = document.createElement('p'); note.textContent = 'No questions yet.'; column.append(note); }
    board.append(column);
  }
  document.getElementById('progress').textContent = `${state.usedQuestionIds.length} of ${state.categories.reduce((count, c) => count + c.questions.length, 0)} clues used · revision ${state.revision}`;
}
