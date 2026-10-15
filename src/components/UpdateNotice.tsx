import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { canSelfUpdate, updateInBackground } from "../selfUpdate.js";
import { currentVersion, fetchNewerVersion, updateCommand } from "../updateCheck.js";

export function UpdateNotice() {
  return canSelfUpdate() ? <AutomaticUpdateNotice /> : <ManualUpdateNotice />;
}

function AutomaticUpdateNotice() {
  const [installedVersion, setInstalledVersion] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    void updateInBackground(controller.signal).then(setInstalledVersion);
    return () => controller.abort();
  }, []);

  if (!installedVersion) return null;
  return (
    <Box marginBottom={1}>
      <Text color="yellow">Updated to Clozemaster CLI {installedVersion}. Restart clozemaster to use it.</Text>
    </Box>
  );
}

function ManualUpdateNotice() {
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
