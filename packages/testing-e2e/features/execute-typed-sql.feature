Feature: Execute SQL queries
  As a developer
  I want to test valnor generated code
  So that I can verify the generated output is correct

  Scenario: Execute SQL queries using valnor
    Given Generated sql mapping code is available in current package
    When Inserting a new Account
    And Inserting 2 new Orders
    Then Fetch newly inserted Account
    When Fetch top 100 accounts including their orders aggregated as json array
    And Accounts should have respective orders