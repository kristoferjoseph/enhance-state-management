export default function TodosList({ html, state }) {
  const { store={} } = state
  const { todos=[] } = store
  const items = todos.map(({ created, completed, key, text })  => {
    completed = completed?.toString() === 'true'
    return html`
    <li id="${key}">
      <todos-item
        created="${created}"
        ${completed ? 'completed' : ''}
        key="${key}"
        text="${text}"
      ></todos-item>
    </li>
  `})
    .join('\n')
  return html`
    <ul
      class="
       grid
       gap0
       list-none
      "
    >
      ${todos.length ? items : `<li>Add a todo</li>`}
    </ul>
  `
}
