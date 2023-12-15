// Check if user data exists in local storage, otherwise initialize an empty array
var users = JSON.parse(localStorage.getItem('users')) || [];

function authenticate() {
  var username = document.getElementById('username').value;
  var password = document.getElementById('password').value;

  // Check if the entered credentials match any user
  var authenticatedUser = users.find(user => user.username === username && user.password === password);

  if (authenticatedUser) {
    // Authentication successful
    alert('Authentication successful!');
    document.getElementById('login-form').reset();
    document.getElementById('error-message').innerText = '';
  } else {
    // Authentication failed
    document.getElementById('error-message').innerText = 'Invalid username or password';
  }
}

function registerUser() {
  var newUsername = document.getElementById('new-username').value;
  var newPassword = document.getElementById('new-password').value;

  // Check if the username is already taken
  var existingUser = users.find(user => user.username === newUsername);

  if (existingUser) {
    // Username already taken
    document.getElementById('error-message').innerText = 'Username already taken';
  } else {
    // Register the new user
    users.push({ username: newUsername, password: newPassword });
    // Store the updated user data in local storage
    localStorage.setItem('users', JSON.stringify(users));
    alert('Registration successful!');
    document.getElementById('register-form').reset();
    document.getElementById('error-message').innerText = '';
  }
}

function toggleForm() {
  var loginForm = document.getElementById('login-form');
  var registerForm = document.getElementById('register-form');
  var authTitle = document.getElementById('auth-title');
  var toggleButton = document.getElementById('toggle-button');

  // Toggle the visibility of the forms
  if (loginForm.classList.contains('hidden')) {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    authTitle.innerText = 'Login';
    toggleButton.innerText = 'Register';
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    authTitle.innerText = 'Register';
    toggleButton.innerText = 'Login';
  }

  // Clear any error messages
  document.getElementById('error-message').innerText = '';
}