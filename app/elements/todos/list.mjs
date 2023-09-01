export default function TodosList({ html, state }) {
  const { store={} } = state
  const { todos=[] } = store
  const items = todos.map(({ completed, key, text })  => {
    completed = completed.toString() === 'true'
    return html`
    <li id="${key}">
      <todos-item
        class="flex"
        ${completed ? 'completed' : ''}
        key="${key}"
        text="${text}"
      ></todos-item>
    </li>
  `})
    .join('\n')
  return html`
    <ul>
      ${todos.length ? items : `<li>Add a todo.</li>`}
    </ul>
  `
}
