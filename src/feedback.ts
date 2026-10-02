import open from "open";

export async function openFeedbackEmail() {
  await open("mailto:support@clozemaster.com?subject=Clozemaster%20CLI%20feedback").catch(() => undefined);
}
