import { describe, it, expect } from "vitest";
import { pageDictionaries } from "@/i18n/page-dictionary";

describe("Auth i18n translation keys", () => {
  const requiredAuthKeys = [
    "auth.checkEmailTitle",
    "auth.checkEmailDescription",
    "auth.checkEmailBody",
    "auth.resendButton",
    "auth.resendEmail",
    "auth.resendSuccess",
    "auth.backToSignIn",
    "auth.alreadySignedIn",
    "auth.signedIn",
    "auth.signedInAs",
    "auth.continueToApp",
    "auth.signOut",
    "auth.resetSentTitle",
    "auth.resetSentDescription",
    "auth.newPassword",
    "auth.sendResetLink",
    "auth.resetLinkSent",
    "auth.updatePasswordButton",
    "auth.passwordUpdated",
  ];

  it("defines all auth keys referenced by AuthView in the English dictionary", () => {
    const enDictionary = pageDictionaries.en;
    for (const key of requiredAuthKeys) {
      const val = enDictionary[key];
      expect(val, `Missing translation key: ${key}`).toBeDefined();
      expect(val?.length).toBeGreaterThan(0);
    }
  });

  it("correctly resolves email interpolation in checkEmailDescription", () => {
    const enDictionary = pageDictionaries.en;
    const template = enDictionary["auth.checkEmailDescription"] ?? "";
    expect(template).toContain("{email}");
    const replaced = template.replace("{email}", "test@example.com");
    expect(replaced).toContain("test@example.com");
    expect(replaced).not.toContain("{email}");
  });
});
