import {
  buildTestID,
  createComponentTestIDs,
  extendIDs,
  getInputTestId,
} from "../index";

describe("buildTestID", () => {
  it("builds a prefixed ID from prefix, component, element", () => {
    expect(buildTestID("btn", "ChatInput", "send")).toBe("btn_ChatInput_send");
  });

  it("preserves casing exactly", () => {
    expect(buildTestID("input", "SearchBar", "query")).toBe(
      "input_SearchBar_query"
    );
  });
});

describe("createComponentTestIDs", () => {
  it("maps buttons category with btn prefix", () => {
    const ids = createComponentTestIDs("ChatInput", {
      buttons: ["send", "mic"] as const,
    });
    expect(ids.buttons.send).toBe("btn_ChatInput_send");
    expect(ids.buttons.mic).toBe("btn_ChatInput_mic");
  });

  it("maps inputs category with input prefix", () => {
    const ids = createComponentTestIDs("SearchBar", {
      inputs: ["query"] as const,
    });
    expect(ids.inputs.query).toBe("input_SearchBar_query");
  });

  it("maps multiple categories simultaneously", () => {
    const ids = createComponentTestIDs("LoginForm", {
      inputs: ["email", "password"] as const,
      buttons: ["submit"] as const,
      labels: ["error"] as const,
    });
    expect(ids.inputs.email).toBe("input_LoginForm_email");
    expect(ids.inputs.password).toBe("input_LoginForm_password");
    expect(ids.buttons.submit).toBe("btn_LoginForm_submit");
    expect(ids.labels.error).toBe("lbl_LoginForm_error");
  });

  it("handles all 11 supported categories", () => {
    const ids = createComponentTestIDs("Widget", {
      buttons: ["a"] as const,
      inputs: ["b"] as const,
      labels: ["c"] as const,
      texts: ["d"] as const,
      icons: ["e"] as const,
      images: ["f"] as const,
      containers: ["g"] as const,
      pressables: ["h"] as const,
      headers: ["i"] as const,
      dialogs: ["j"] as const,
      sheets: ["k"] as const,
    });
    expect(ids.buttons.a).toBe("btn_Widget_a");
    expect(ids.icons.e).toBe("icon_Widget_e");
    expect(ids.sheets.k).toBe("sheet_Widget_k");
  });
});

describe("extendIDs", () => {
  it("returns values of an existing testIDs sub-tree as an array", () => {
    const parent = createComponentTestIDs("Parent", {
      buttons: ["ok", "cancel"] as const,
    });
    const extended = extendIDs(parent.buttons);
    expect(extended).toContain("btn_Parent_ok");
    expect(extended).toContain("btn_Parent_cancel");
  });

  it("returns an empty array for an empty object", () => {
    expect(extendIDs({})).toEqual([]);
  });
});

describe("getInputTestId", () => {
  it("returns input, focus, and clear sub-IDs", () => {
    const ids = getInputTestId("input_SearchBar_query");
    expect(ids.input).toBe("input_SearchBar_query");
    expect(ids.focus).toBe("input_SearchBar_queryFocus");
    expect(ids.clear).toBe("input_SearchBar_queryClear");
  });
});
