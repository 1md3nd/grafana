---
title: Planning IAM integration strategy
menuTitle: IAM integration
description: Considerations and .
aliases:
  - /docs/mimir/latest/old-architecture/
  - docs/sources/auth/planning/
weight: 200
keywords:
  - IdP
  - IAM
  - Auth
---

# Planning your IAM integration strategy

This topic describes the decisions you should make when using an Identity and Access Management (IAM) provider to manage access to Grafana. IAM ensures that users have secure access to sensitive data and [Grafana resources], simplifying user management and authentication.

## Benefits of integrating with an IAM provider

Integrating with an IAM provider provides the following benefits:

- **User management**: By providing Grafana access to your current user database, you eliminate the overhead of replicating user information and instead have centralized user management for users' roles and permissions to Grafana resources.

- **Security**: IAM solutions provide advanced security features such as MFA, RBCA, and audit trails, which can help to improve the security of your Grafana installation.

- **SSO**: Properly setting up Grafana with your current IAM solution enables users to access Grafana with the same credentials they use for other applications.

- **Scalability**: Adding, updating, or removing users from your user database is immediately reflected in Grafana.

In order to plan an integration with Grafana, assess your organization's current needs, requirements and any existing IAM solutions being used. This should include which set of roles and permissions will be match to each type of user and which groups of users share the same set of permissions and access to shared resources.

After considering needs, chosen IAM solution and taking into consideration the security requirements, the last step is to test it out thoroughly before deploying it to a production environment.

## Internal vs external users

As a first step, determine where your Grafana users are located. Are the users located within your organization, or are they outside your organization?

If the users are within your organization, Grafana might be able to integrate with those users through an identify provider.

If the users are outside your organization, you must provide anonymous access to Grafana, which is not enabled by default.

For information about enabling anonymous access, refer to the [documentation](../../setup-grafana/configure-security/configure-authentication/_index.md#anonymous-authentication)

## Ways to organize users

Organize users in subgroups that are sensible to the organization. These are some examples:

- **Security**: Different groups of users or customers should only have access to their intended resources.
- **Simplicity**: Reduce the scope of dashboards and resources available.
- **Cost attribution**: Track and bill costs to their customers, departments, or divisions.
- **Customization**: Each group of users could have a personalized experience like different dashboards or theme colours.

### Users in Grafana Teams

You can organize users into [Teams] and assign them roles and permissions reflecting the current organization. For example, instead of assigning five users access to the same dashboard, you can create a team that consists of those users and assign dashboard permissions to the team. A user can belong to multiple teams.

A user can be a Member or an Administrator for a given team. Members of a team inherit permissions from the team, but they cannot edit the team itself. Team Administrators can add members to a team and update its settings, such as the team name, team members' team roles, UI preferences, and the default dashboard to be displayed upon login for the team members.

Teams are a perfect solution for working with a small subset of users. Teams can share resources with other teams.

### Users in Grafana Organizations

[Grafana Organizations] isolate users from dashboards and data sources by having multiple organizations under a single instance of Grafana. This means users under different organizations won't share any resources such as dashboards, folders, and data sources.

By default, organizations provide a measure of isolation within Grafana. They can be used to present different user experiences, which gives the appearance that there are multiple instances of Grafana within a single instance. However, because they lack the scalability of [Folders], we do not recommend using organizations as a way to group users.

### Choosing between teams and organizations

[Grafana teams] and Grafana organizations serve similar purposes in the Grafana platform. While both are designed to help manage and control access to resources, teams provide a more focused approach for smaller groups or projects. Teams also enable collaboration and shared ownership of resources among members, making it simple to manage access and control who has access to which resources.

In contrast, organizations provide a higher level of management for multiple teams and resources. They are designed for larger enterprises or organizations with a complex setup or multiple or different business models.

## Access to external systems

Consider the need for machine-to-machine [M2M] communications. If a system needs to interact with Grafana, ensure it has proper access.

Consider the following scenarios:

**IoT devices monitoring**: Sensors and actuators might feed information into Grafana in an automatic way. Consider the security implications of a shared security access for all the devices or an individual access to each of them.

**Network monitoring**: Having distributed systems architecture performance reported back to Grafana can provide insight into bottlenecks and trigger alerts that should be resolved promptly.

**Stocks**: Keeping track of the stocks changes overtime can be automated with by an automated agent feeding information into Grafana. Thus, keeping track of the changes overtime.

These are just a few examples of how Grafana can be used in M2M scenarios. The platform is highly flexible and can be used in a variety of other M2M applications, making it a powerful tool for organizations looking to gain insights into their systems and devices.

### 🚧 Service Accounts

### 🚧 Personal access tokens

### 🚧 API keys

## 🚧 How to work with roles?

### 🚧 What are permissions?

### 🚧 What are roles?

### 🚧 Grafana roles vs RBAC: Which one is for me?

## 🚧 Will I need synchronization?

### 🚧 Team sync

### 🚧 Organization sync
