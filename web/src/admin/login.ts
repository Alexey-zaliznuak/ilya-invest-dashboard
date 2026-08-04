import { ApiError, login } from '../lib/api';

export interface LoginFormElements {
  form: HTMLFormElement;
  loginInput: HTMLInputElement;
  passwordInput: HTMLInputElement;
  submit: HTMLButtonElement;
  error: HTMLElement;
}

export function setupLoginForm(
  elements: LoginFormElements,
  onSuccess: (adminLogin: string) => void,
): void {
  elements.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    elements.error.hidden = true;
    elements.submit.disabled = true;

    try {
      const session = await login(elements.loginInput.value, elements.passwordInput.value);
      elements.passwordInput.value = '';
      onSuccess(session.login);
    } catch (error) {
      elements.error.textContent =
        error instanceof ApiError ? error.message : 'Не удалось выполнить вход';
      elements.error.hidden = false;
    } finally {
      elements.submit.disabled = false;
    }
  });
}
