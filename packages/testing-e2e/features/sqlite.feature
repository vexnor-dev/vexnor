Feature: Execute SQLite queries
  As a developer
  I want to test valnor generated code for SQLite
  So that I can verify the generated output is correct

  Scenario: Execute SQL queries using valnor with SQLite
    Given Generated SQLite sql mapping code is available in current package
    When Inserting a new Account using SQLite
    And Inserting 2 new Orders using SQLite
    Then Fetch newly inserted Account using SQLite
    When Fetch top 100 accounts including their orders aggregated as json array using SQLite
    And Accounts should have respective orders using SQLite