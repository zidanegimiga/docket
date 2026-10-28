import { useMutation } from "@tanstack/react-query";

import { signUp } from "../api/auth.api";

export function useSignUp() {
  return useMutation({ mutationFn: signUp });
}
