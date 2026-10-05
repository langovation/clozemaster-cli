import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { currentVersion, fetchNewerVersion, updateCommand } from "../updateCheck.js";

export function UpdateNotice() {
  const [newerVersion, setNewerVersion] = useState<string>();

  useEffect(() => {
    void fetchNewerVersion().then(setNewerVersion);
  }, []);

  if (!newerVersion) return null;
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="yellow">
        Clozemaster CLI {newerVersion} is out (you have {currentVersion}). Update with:
      </Text>
      <Text>{updateCommand}</Text>
    </Box>
  );
}
