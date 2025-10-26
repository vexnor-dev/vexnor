Feature: Stress testing valnor with advanced PostgreSQL queries

  Scenario: Insert and select a product with JSONB metadata
    Given the database is clean
    When I insert a product with the following metadata:
      """
      {
        "tags": ["electronics", "wearable"],
        "specs": {
          "screen_size": "1.5 inch",
          "battery_life": "24 hours"
        }
      }
      """
    Then I should be able to retrieve the product and its metadata

  Scenario: Query a product by a nested JSONB property
    Given the database is clean
    When I insert a product with the following metadata:
      """
      {
        "tags": ["electronics", "wearable"],
        "specs": {
          "screen_size": "1.5 inch",
          "battery_life": "24 hours"
        }
      }
      """
    And I insert a product with the following metadata:
      """
      {
        "tags": ["electronics", "smart home"],
        "specs": {
          "screen_size": "7 inch",
          "battery_life": "N/A"
        }
      }
      """
    When I query for products with screen size "1.5 inch"
    Then I should find 1 product

  Scenario: Query a product by a value in a JSONB array
    Given the database is clean
    When I insert a product with the following metadata:
      """
      {
        "tags": ["electronics", "wearable"],
        "specs": {
          "screen_size": "1.5 inch",
          "battery_life": "24 hours"
        }
      }
      """
    And I insert a product with the following metadata:
      """
      {
        "tags": ["electronics", "smart home"],
        "specs": {
          "screen_size": "7 inch",
          "battery_life": "N/A"
        }
      }
      """
    When I query for products with the tag "wearable"
    Then I should find 1 product

  Scenario: Update a product's nested JSONB metadata
    Given the database is clean
    When I insert a product with the following metadata:
      """
      {
        "tags": ["electronics", "wearable"],
        "specs": {
          "screen_size": "1.5 inch",
          "battery_life": "24 hours"
        }
      }
      """
    When I update the battery life of the product to "30 hours"
    Then the product's battery life should be "30 hours"

  Scenario: Query orders by joining on product metadata
    Given the database is clean
    And an account exists
    And I insert a product with the following metadata:
      """
      {
        "tags": ["electronics", "wearable"],
        "specs": {
          "screen_size": "1.5 inch",
          "battery_life": "24 hours"
        }
      }
      """
    And I create an order for the product
    When I query for orders with items tagged as "wearable"
    Then I should find 1 order

  Scenario: Insert and select a product with a native array column
    Given the database is clean
    When I insert a product with the tags "electronics" and "wearable"
    Then I should be able to retrieve the product and its tags

  Scenario: Query a product by a value in a native array column
    Given the database is clean
    When I insert a product with the tags "electronics" and "wearable"
    And I insert a product with the tags "electronics" and "smart home"
    When I query for products with the array tag "wearable"
    Then I should find 1 product

  Scenario: Query a product by array overlap
    Given the database is clean
    When I insert a product with the tags "electronics" and "wearable"
    And I insert a product with the tags "electronics" and "smart home"
    When I query for products with any of the array tags "wearable" or "smart home"
    Then I should find 2 products
