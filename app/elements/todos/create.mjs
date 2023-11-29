export default function TodosCreate({ html, state }) {
  const { instanceID='' } = state
  const borderClasses = `
    border1
    border-solid
    border-current
    radius0
    overflow-hidden
  `

  return html`
<fieldset>
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
        for="text-${instanceID}"
      >
        Text
      </label>
      <input
        id="text-${instanceID}"
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
  </form>
</fieldset>
  `
}
