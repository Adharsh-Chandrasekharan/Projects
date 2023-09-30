function calculateEMI(principal, rate, time) {
  rate = rate / 100;
  var totalAmount = principal + ( principal * rate * time );
  var emi = totalAmount/12;
  return emi
  
}


function calculateLoanEMI() {
  var principalAmount = parseFloat(document.getElementById('principal').value);
  var interestRate = parseFloat(document.getElementById('intrest').value);
  var loanTime = parseFloat(document.getElementById('time').value);
  
  var emi = calculateEMI(principalAmount, interestRate, loanTime);
  
  document.getElementById('result').innerHTML = "EMI: " + emi;
}

function handleKey(event){
  if (event.key == 'Enter'){
    calculateLoanEMI()
  }
}









