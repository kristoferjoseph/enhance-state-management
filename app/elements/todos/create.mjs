export default function TodosCreate({ html, state }) {
  const borderClasses = `
    border1
    border-solid
    border-current
    radius0
    overflow-hidden
  `

  return html`
<fieldset
>
  <legend class="text2 mb1">
    Todos
  </legend>
  <form
    action="/todos"
    method="POST"
  >
    <div
      class="
        flex
        flex-col
      "
    >
      <label
        for="text"
      >
        Text
      </label>
      <input
        class="
         ${borderClasses}
        "
        name="text"
        type="text"
        placeholder="Add a title ⏎"
        autofocus
        required
      >
    </div>

    <form action="/todos"></form>
  `
}
