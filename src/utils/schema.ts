type Schema = Record<string, unknown>;

export const Type = {
  Object(properties: Record<string, Schema>, options: Schema = {}): Schema {
    const required = Object.entries(properties)
      .filter(([, schema]) => schema.optional !== true)
      .map(([key]) => key);

    const normalized = Object.fromEntries(
      Object.entries(properties).map(([key, schema]) => {
        const { optional: _optional, ...rest } = schema;
        return [key, rest];
      })
    );

    return {
      type: "object",
      properties: normalized,
      required,
      additionalProperties: false,
      ...options,
    };
  },

  String(options: Schema = {}): Schema {
    return { type: "string", ...options };
  },

  Boolean(options: Schema = {}): Schema {
    return { type: "boolean", ...options };
  },

  Array(items: Schema, options: Schema = {}): Schema {
    return { type: "array", items, ...options };
  },

  Optional(schema: Schema): Schema {
    return { ...schema, optional: true };
  },
};
