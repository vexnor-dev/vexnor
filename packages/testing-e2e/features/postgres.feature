Feature: Execute PostgreSQL queries
  As a developer
  I want to test valnor generated code for PostgreSQL
  So that I can verify the generated output is correct

  Scenario: Execute SQL queries using valnor with PostgreSQL
    Given Generated PostgreSQL sql mapping code is available in current package
    When Inserting a new Account using PostgreSQL
    And Inserting 2 new Orders using PostgreSQL
    Then Fetch newly inserted Account using PostgreSQL
    When Fetch top 100 accounts including their orders aggregated as json array using PostgreSQL
    And Accounts should have respective orders using PostgreSQL