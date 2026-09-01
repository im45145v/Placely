export function isValidOAuthState(expectedState, receivedState) {
  return Boolean(
    expectedState &&
      receivedState &&
      expectedState.length > 0 &&
      expectedState === receivedState
  );
}
