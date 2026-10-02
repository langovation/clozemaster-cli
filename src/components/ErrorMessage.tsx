import React from "react";
import { Text } from "ink";
import { colors } from "../theme.js";

export function ErrorMessage({ error }: { error: Error }) {
  return <Text color={colors.danger}>{error.message}</Text>;
}
