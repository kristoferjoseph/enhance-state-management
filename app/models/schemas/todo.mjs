export const Todo = {
  "id": "Todo",
  "type": "object",
  "properties": {
    "text": {
      "type": "string",
      "required": "true"
    },
    "created": {
      "type": "string",
      "format": "date"
    },
    "completed": {
      "type": "boolean"
    },
    "key": {
      "type": "string"
    }
  }
}
