Feature: Execute MSSQL queries
  As a developer
  I want to test valnor generated code for MSSQL
  So that I can verify the generated output is correct

  Scenario: Execute SQL queries using valnor with MSSQL
    Given Generated MSSQL sql mapping code is available in current package
    When Inserting a new Account using MSSQL
    And Inserting 2 new Orders using MSSQL
    Then Fetch newly inserted Account using MSSQL
    When Fetch top 100 accounts including their orders aggregated as json array using MSSQL
    And Accounts should have respective orders using MSSQL