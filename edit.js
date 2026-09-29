import { removeCategory, removeQuestion } from './store.js';
export function createEditor({ save, getSnapshot }) {
  const dialog = document.getElementById('editor-modal'); const container = document.getElementById('editor-container');
  let draft, baseline;
  function field(labelText, value, change, { max = 1000, numeric = false, multiline = false } = {}) {
    const label = document.createElement('label'); label.append(document.createTextNode(labelText)); const input = document.createElement(multiline ? 'textarea' : 'input');
    input.value = value; input.required = true;
    if (numeric) { input.type = 'number'; input.min = '100'; input.max = '10000'; input.step = '100'; } else input.maxLength = max;
    input.addEventListener('input', () => change(numeric ? Number(input.value) : input.value)); label.append(input); return label;
  }
  function button(label, action) { const result = document.createElement('button'); result.type = 'button'; result.textContent = label; result.addEventListener('click', action); return result; }
  function render() {
    container.replaceChildren();
    draft.categories.forEach((category, categoryIndex) => {
      const section = document.createElement('section'); section.className = 'editor-category';
      section.append(field(`Category ${categoryIndex+1} name`, category.name, value => { category.name = value; }, { max: 80 }));
      section.append(button(`Delete category ${categoryIndex+1}`, () => { if (confirm('Remove this category and its questions from the draft?')) { draft = removeCategory(draft, category.id); render(); } }));
      category.questions.forEach((question, index) => {
        const group = document.createElement('fieldset'); const legend = document.createElement('legend'); legend.textContent = `Question ${index+1}`; group.append(legend);
        group.append(field(`Category ${categoryIndex+1} question ${index+1} prompt`, question.prompt, value => { question.prompt = value; }, { multiline: true }), field(`Category ${categoryIndex+1} question ${index+1} answer`, question.answer, value => { question.answer = value; }, { multiline: true }), field(`Category ${categoryIndex+1} question ${index+1} points`, question.points, value => { question.points = value; }, { numeric: true }));
        group.append(button(`Delete question ${index+1} from category ${categoryIndex+1}`, () => { if (confirm('Remove this question from the draft?')) { draft = removeQuestion(draft, category.id, question.id); render(); } })); section.append(group);
      });
      const add = button(`Add question to category ${categoryIndex+1}`, () => { category.questions.push({ id: crypto.randomUUID(), prompt: '', answer: '', points: 100 }); render(); }); add.disabled = category.questions.length >= 20; section.append(add); container.append(section);
    });
    document.getElementById('add-category').disabled = draft.categories.length >= 10;
  }
  function open() { const current = getSnapshot(); draft = structuredClone(current.state); baseline = current.raw; document.getElementById('editor-error').textContent = ''; render(); dialog.showModal(); }
  document.getElementById('add-category').addEventListener('click', () => { if (draft.categories.length < 10) { draft.categories.push({ id: crypto.randomUUID(), name: '', questions: [] }); render(); } });
  document.getElementById('close-editor').addEventListener('click', () => dialog.close());
  document.getElementById('editor-form').addEventListener('submit', async event => { event.preventDefault(); if (await save(draft, baseline)) dialog.close(); });
  return { open, dialog };
}
