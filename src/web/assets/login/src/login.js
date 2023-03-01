import './login.scss';

(function ($) {
  /** global: Craft */
  /** global: Garnish */
  var LoginForm = Garnish.Base.extend({
    $loginDiv: null,
    $form: null,
    $loginNameInput: null,
    $passwordInput: null,
    $rememberMeCheckbox: null,
    $forgotPasswordLink: null,
    $rememberPasswordLink: null,
    $mfaFormContainer: null,
    $alternativeMfaLink: null,
    $submitBtn: null,
    $errors: null,

    forgotPassword: false,
    validateOnInput: false,
    mfa: false,

    init: function () {
      this.$loginDiv = $('#login');
      this.$form = $('#login-form');
      this.$loginNameInput = $('#loginName');
      this.$passwordInput = $('#password');
      this.$rememberMeCheckbox = $('#rememberMe');
      this.$forgotPasswordLink = $('#forgot-password');
      this.$rememberPasswordLink = $('#remember-password');
      this.$mfaFormContainer = $('#mfa-form');
      this.$alternativeMfaLink = $('#alternative-mfa');
      this.$submitBtn = $('#submit');
      this.$errors = $('#login-errors');

      new Craft.PasswordInput(this.$passwordInput, {
        onToggleInput: ($newPasswordInput) => {
          this.removeListener(this.$passwordInput, 'input');
          this.$passwordInput = $newPasswordInput;
          this.addListener(this.$passwordInput, 'input', 'onInput');
        },
      });

      this.addListener(this.$loginNameInput, 'input', 'onInput');
      this.addListener(this.$passwordInput, 'input', 'onInput');
      this.addListener(this.$forgotPasswordLink, 'click', 'onSwitchForm');
      this.addListener(this.$rememberPasswordLink, 'click', 'onSwitchForm');
      this.addListener(
        this.$alternativeMfaLink,
        'click',
        'showAlternativeMfaMethods'
      );
      this.addListener(this.$form, 'submit', 'onSubmit');

      // Focus first empty field in form
      if (!Garnish.isMobileBrowser()) {
        if (this.$loginNameInput.val()) {
          this.$passwordInput.focus();
        } else {
          this.$loginNameInput.focus();
        }
      }
    },

    validate: function () {
      const loginNameVal = this.$loginNameInput.val();
      if (loginNameVal.length === 0) {
        if (window.useEmailAsUsername) {
          return Craft.t('app', 'Invalid email.');
        }
        return Craft.t('app', 'Invalid username or email.');
      }

      if (window.useEmailAsUsername && !loginNameVal.match('.+@.+..+')) {
        return Craft.t('app', 'Invalid email.');
      }

      if (!this.forgotPassword) {
        const passwordLength = this.$passwordInput.val().length;
        if (passwordLength < window.minPasswordLength) {
          return Craft.t(
            'yii',
            '{attribute} should contain at least {min, number} {min, plural, one{character} other{characters}}.',
            {
              attribute: Craft.t('app', 'Password'),
              min: window.minPasswordLength,
            }
          );
        }
        if (passwordLength > window.maxPasswordLength) {
          return Craft.t(
            'yii',
            '{attribute} should contain at most {max, number} {max, plural, one{character} other{characters}}.',
            {
              attribute: Craft.t('app', 'Password'),
              max: window.maxPasswordLength,
            }
          );
        }
      }

      return true;
    },

    onInput: function (event) {
      if (this.validateOnInput && this.validate() === true) {
        this.clearErrors();
      }
    },

    onSubmit: function (event) {
      // Prevent full HTTP submits
      event.preventDefault();

      const error = this.validate();
      if (error !== true) {
        this.showError(error);
        this.validateOnInput = true;
        return;
      }

      this.$submitBtn.addClass('loading');

      this.clearErrors();

      if (this.forgotPassword) {
        this.submitForgotPassword();
      } else if (this.mfa) {
        this.submitMfa();
      } else {
        this.submitLogin();
      }
    },

    submitMfa: function () {
      let data = {};

      this.$mfaFormContainer.find('input').each(function (index, element) {
        data[$(element).attr('name')] = $(element).val();
      });

      Craft.sendActionRequest('POST', 'users/verify-mfa', {data})
        .then((response) => {
          window.location.href = response.data.returnUrl;
        })
        .catch(({response}) => {
          Garnish.shake(this.$form, 'left');
          this.onSubmitResponse();

          // Add the error message
          this.showError(response.data.message);
        });

      return false;
    },

    submitForgotPassword: function () {
      var data = {
        loginName: this.$loginNameInput.val(),
      };

      Craft.sendActionRequest('POST', 'users/send-password-reset-email', {data})
        .then((response) => {
          new MessageSentModal();
        })
        .catch(({response}) => {
          this.showError(response.data.message);
        });
    },

    submitLogin: function () {
      var data = {
        loginName: this.$loginNameInput.val(),
        password: this.$passwordInput.val(),
        rememberMe: this.$rememberMeCheckbox.prop('checked') ? 'y' : '',
      };

      Craft.sendActionRequest('POST', 'users/login', {data})
        .then((response) => {
          if (response.data.mfa !== undefined && response.data.mfa == true) {
            this.showMfaForm(response.data.mfaForm);
          } else {
            window.location.href = response.data.returnUrl;
          }
        })
        .catch(({response}) => {
          Garnish.shake(this.$form, 'left');
          this.onSubmitResponse();

          // Add the error message
          this.showError(response.data.message);
        });

      return false;
    },

    showMfaForm: function (mfaForm) {
      this.mfa = true;
      this.$mfaFormContainer.append(mfaForm);
      this.$loginDiv.addClass('mfa');
      this.onSubmitResponse();
    },

    onSubmitResponse: function () {
      this.$submitBtn.removeClass('loading');
    },

    showError: function (error) {
      this.clearErrors();

      $('<p style="display: none;">' + error + '</p>')
        .appendTo(this.$errors)
        .velocity('fadeIn');
    },

    clearErrors: function () {
      this.$errors.empty();
    },

    onSwitchForm: function (event) {
      if (!Garnish.isMobileBrowser()) {
        this.$loginNameInput.trigger('focus');
      }

      this.clearErrors();

      this.forgotPassword = !this.forgotPassword;

      this.$form.toggleClass('reset-password', this.forgotPassword);
      this.$submitBtn.text(
        Craft.t('app', this.forgotPassword ? 'Reset Password' : 'Sign in')
      );
    },

    showAlternativeMfaMethods: function (event) {
      // get current authenticator class via data-authenticator
      let currentAuthenticator = this.$mfaFormContainer
        .find('#verifyContainer')
        .attr('data-authenticator');
      if (
        currentAuthenticator === undefined ||
        currentAuthenticator.length === 0
      ) {
        this.$alternativeMfaLink.hide();
        this.showError('No alternative MFA methods available.');
      }

      let data = {
        currentAuthenticator: currentAuthenticator,
      };

      // get available MFA methods, minus the one that's being shown
      let alternativeMfaMethods = this.getAlternativeMfaOptions(data);
      console.log(alternativeMfaMethods);

      // list them by name with description?
      // clicking on a method name swaps the form fields
      console.log('show other methods'); // todo: finish me
    },

    getAlternativeMfaOptions: function (data) {
      Craft.sendActionRequest(
        'POST',
        'authentication/get-alternative-mfa-options',
        {data}
      )
        .then((response) => {
          console.log(response.data.alternativeOptions);
          return response.data.alternativeOptions;
        })
        .catch(({response}) => {
          this.showError(response.data.message);
          return false;
        });
    },
  });

  var MessageSentModal = Garnish.Modal.extend({
    init: function () {
      var $container = $(
        '<div class="modal fitted email-sent"><div class="body">' +
          Craft.t(
            'app',
            'Check your email for instructions to reset your password.'
          ) +
          '</div></div>'
      ).appendTo(Garnish.$bod);

      this.base($container);
    },

    hide: function () {},
  });

  new LoginForm();
})(jQuery);
