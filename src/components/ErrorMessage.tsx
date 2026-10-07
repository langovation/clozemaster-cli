import React from "react";
import { Box, Text, useInput } from "ink";
import open from "open";
import { ProRequiredError } from "../api.js";
import { colors } from "../theme.js";
import { Hints } from "./Hints.js";

function ProUpgrade({ error }: { error: ProRequiredError }) {
  useInput((input) => {
    if (input === "u") open(error.upgradeUrl).catch(() => undefined);
  });
  return (
    <Box flexDirection="column">
      <Text color={colors.gold}>{error.message}</Text>
      <Text>Upgrade at <Text color={colors.brand} underline>{error.upgradeUrl}</Text></Text>
      <Hints hints={["u open upgrade page"]} />
    </Box>
  );
}

export function ErrorMessage({ error }: { error: Error }) {
  if (error instanceof ProRequiredError) return <ProUpgrade error={error} />;
  return <Text color={colors.danger}>{error.message}</Text>;
}
