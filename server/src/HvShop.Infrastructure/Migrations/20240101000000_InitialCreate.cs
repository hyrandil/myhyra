using System;
using HvShop.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace HvShop.Infrastructure.Migrations;

[DbContext(typeof(ApplicationDbContext))]
[Migration("20240101000000_InitialCreate")]
public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Images",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Name = table.Column<string>(type: "text", nullable: false),
                Version = table.Column<string>(type: "text", nullable: false),
                OsType = table.Column<string>(type: "text", nullable: false),
                PathOrCatalogId = table.Column<string>(type: "text", nullable: false),
                DefaultCredentialsHint = table.Column<string>(type: "text", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Images", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "PricingRules",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Name = table.Column<string>(type: "text", nullable: false),
                CpuPriceCents = table.Column<long>(type: "bigint", nullable: false),
                RamPriceCentsPerGb = table.Column<long>(type: "bigint", nullable: false),
                StoragePriceCentsPerGb = table.Column<long>(type: "bigint", nullable: false),
                Currency = table.Column<string>(type: "text", nullable: false),
                Active = table.Column<bool>(type: "boolean", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_PricingRules", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "Roles",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Name = table.Column<string>(type: "text", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Roles", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "Users",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Email = table.Column<string>(type: "text", nullable: false),
                PasswordHash = table.Column<string>(type: "text", nullable: true),
                ExternalIdpSub = table.Column<string>(type: "text", nullable: true),
                Role = table.Column<string>(type: "text", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Users", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "RolePermissions",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Permission = table.Column<string>(type: "text", nullable: false),
                RoleId = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_RolePermissions", x => x.Id);
                table.ForeignKey(
                    name: "FK_RolePermissions_Roles_RoleId",
                    column: x => x.RoleId,
                    principalTable: "Roles",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "ApiKeys",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Name = table.Column<string>(type: "text", nullable: false),
                HashedKey = table.Column<string>(type: "text", nullable: false),
                Role = table.Column<string>(type: "text", nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                LastUsedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                UserId = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ApiKeys", x => x.Id);
                table.ForeignKey(
                    name: "FK_ApiKeys_Users_UserId",
                    column: x => x.UserId,
                    principalTable: "Users",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "Hosts",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Hostname = table.Column<string>(type: "text", nullable: false),
                Fqdn = table.Column<string>(type: "text", nullable: true),
                Ip = table.Column<string>(type: "text", nullable: false),
                AgentVersion = table.Column<string>(type: "text", nullable: false),
                Os = table.Column<string>(type: "text", nullable: false),
                HypervVersion = table.Column<string>(type: "text", nullable: false),
                TotalCpuCores = table.Column<int>(type: "integer", nullable: false),
                TotalRamMb = table.Column<int>(type: "integer", nullable: false),
                TotalStorageGb = table.Column<int>(type: "integer", nullable: false),
                Status = table.Column<string>(type: "text", nullable: false),
                LastSeenAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Hosts", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "Orders",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                UserId = table.Column<Guid>(type: "uuid", nullable: false),
                Status = table.Column<string>(type: "text", nullable: false),
                TotalCents = table.Column<long>(type: "bigint", nullable: false),
                Currency = table.Column<string>(type: "text", nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                PaymentProvider = table.Column<string>(type: "text", nullable: false),
                PaymentIntentId = table.Column<string>(type: "text", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Orders", x => x.Id);
                table.ForeignKey(
                    name: "FK_Orders_Users_UserId",
                    column: x => x.UserId,
                    principalTable: "Users",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "AuditLogs",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                ActorUserId = table.Column<Guid>(type: "uuid", nullable: true),
                ActorApiKeyId = table.Column<Guid>(type: "uuid", nullable: true),
                Action = table.Column<string>(type: "text", nullable: false),
                TargetType = table.Column<string>(type: "text", nullable: false),
                TargetId = table.Column<Guid>(type: "uuid", nullable: true),
                Timestamp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                Ip = table.Column<string>(type: "text", nullable: true),
                DetailsJson = table.Column<string>(type: "text", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_AuditLogs", x => x.Id);
                table.ForeignKey(
                    name: "FK_AuditLogs_ApiKeys_ActorApiKeyId",
                    column: x => x.ActorApiKeyId,
                    principalTable: "ApiKeys",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_AuditLogs_Users_ActorUserId",
                    column: x => x.ActorUserId,
                    principalTable: "Users",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "HostMetrics",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                HostId = table.Column<Guid>(type: "uuid", nullable: false),
                Ts = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                CpuPct = table.Column<double>(type: "double precision", nullable: false),
                MemUsedMb = table.Column<int>(type: "integer", nullable: false),
                MemPct = table.Column<double>(type: "double precision", nullable: false),
                StorageUsedGb = table.Column<double>(type: "double precision", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_HostMetrics", x => x.Id);
                table.ForeignKey(
                    name: "FK_HostMetrics_Hosts_HostId",
                    column: x => x.HostId,
                    principalTable: "Hosts",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateTable(
            name: "VirtualMachines",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                HostId = table.Column<Guid>(type: "uuid", nullable: false),
                OwnerId = table.Column<Guid>(type: "uuid", nullable: true),
                Name = table.Column<string>(type: "text", nullable: false),
                CpuCores = table.Column<int>(type: "integer", nullable: false),
                MemoryMb = table.Column<int>(type: "integer", nullable: false),
                StorageGb = table.Column<int>(type: "integer", nullable: false),
                State = table.Column<string>(type: "text", nullable: false),
                OsImage = table.Column<string>(type: "text", nullable: false),
                Ip = table.Column<string>(type: "text", nullable: true),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_VirtualMachines", x => x.Id);
                table.ForeignKey(
                    name: "FK_VirtualMachines_Hosts_HostId",
                    column: x => x.HostId,
                    principalTable: "Hosts",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "FK_VirtualMachines_Users_OwnerId",
                    column: x => x.OwnerId,
                    principalTable: "Users",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "OrderItems",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                OrderId = table.Column<Guid>(type: "uuid", nullable: false),
                HostId = table.Column<Guid>(type: "uuid", nullable: true),
                VmId = table.Column<Guid>(type: "uuid", nullable: true),
                CpuCores = table.Column<int>(type: "integer", nullable: false),
                MemoryMb = table.Column<int>(type: "integer", nullable: false),
                StorageGb = table.Column<int>(type: "integer", nullable: false),
                OsImage = table.Column<string>(type: "text", nullable: false),
                HostnameRequest = table.Column<string>(type: "text", nullable: true),
                Quantity = table.Column<int>(type: "integer", nullable: false),
                UnitPriceCents = table.Column<long>(type: "bigint", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_OrderItems", x => x.Id);
                table.ForeignKey(
                    name: "FK_OrderItems_Hosts_HostId",
                    column: x => x.HostId,
                    principalTable: "Hosts",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
                table.ForeignKey(
                    name: "FK_OrderItems_Orders_OrderId",
                    column: x => x.OrderId,
                    principalTable: "Orders",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "FK_OrderItems_VirtualMachines_VmId",
                    column: x => x.VmId,
                    principalTable: "VirtualMachines",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "ProvisioningJobs",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                Type = table.Column<string>(type: "text", nullable: false),
                PayloadJson = table.Column<string>(type: "text", nullable: false),
                Status = table.Column<string>(type: "text", nullable: false),
                HostId = table.Column<Guid>(type: "uuid", nullable: false),
                VmId = table.Column<Guid>(type: "uuid", nullable: true),
                CreatedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                StartedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                FinishedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                Error = table.Column<string>(type: "text", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_ProvisioningJobs", x => x.Id);
                table.ForeignKey(
                    name: "FK_ProvisioningJobs_Hosts_HostId",
                    column: x => x.HostId,
                    principalTable: "Hosts",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Cascade);
                table.ForeignKey(
                    name: "FK_ProvisioningJobs_VirtualMachines_VmId",
                    column: x => x.VmId,
                    principalTable: "VirtualMachines",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_ApiKeys_HashedKey",
            table: "ApiKeys",
            column: "HashedKey",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_ApiKeys_UserId",
            table: "ApiKeys",
            column: "UserId");

        migrationBuilder.CreateIndex(
            name: "IX_AuditLogs_ActorApiKeyId",
            table: "AuditLogs",
            column: "ActorApiKeyId");

        migrationBuilder.CreateIndex(
            name: "IX_AuditLogs_ActorUserId",
            table: "AuditLogs",
            column: "ActorUserId");

        migrationBuilder.CreateIndex(
            name: "IX_HostMetrics_HostId",
            table: "HostMetrics",
            column: "HostId");

        migrationBuilder.CreateIndex(
            name: "IX_Hosts_Hostname",
            table: "Hosts",
            column: "Hostname",
            unique: true);

        migrationBuilder.CreateIndex(
            name: "IX_OrderItems_HostId",
            table: "OrderItems",
            column: "HostId");

        migrationBuilder.CreateIndex(
            name: "IX_OrderItems_OrderId",
            table: "OrderItems",
            column: "OrderId");

        migrationBuilder.CreateIndex(
            name: "IX_OrderItems_VmId",
            table: "OrderItems",
            column: "VmId");

        migrationBuilder.CreateIndex(
            name: "IX_Orders_UserId",
            table: "Orders",
            column: "UserId");

        migrationBuilder.CreateIndex(
            name: "IX_ProvisioningJobs_HostId",
            table: "ProvisioningJobs",
            column: "HostId");

        migrationBuilder.CreateIndex(
            name: "IX_ProvisioningJobs_VmId",
            table: "ProvisioningJobs",
            column: "VmId");

        migrationBuilder.CreateIndex(
            name: "IX_RolePermissions_RoleId",
            table: "RolePermissions",
            column: "RoleId");

        migrationBuilder.CreateIndex(
            name: "IX_VirtualMachines_HostId",
            table: "VirtualMachines",
            column: "HostId");

        migrationBuilder.CreateIndex(
            name: "IX_VirtualMachines_OwnerId",
            table: "VirtualMachines",
            column: "OwnerId");

        migrationBuilder.CreateIndex(
            name: "IX_Users_Email",
            table: "Users",
            column: "Email",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "AuditLogs");

        migrationBuilder.DropTable(
            name: "HostMetrics");

        migrationBuilder.DropTable(
            name: "Images");

        migrationBuilder.DropTable(
            name: "OrderItems");

        migrationBuilder.DropTable(
            name: "PricingRules");

        migrationBuilder.DropTable(
            name: "ProvisioningJobs");

        migrationBuilder.DropTable(
            name: "RolePermissions");

        migrationBuilder.DropTable(
            name: "ApiKeys");

        migrationBuilder.DropTable(
            name: "Orders");

        migrationBuilder.DropTable(
            name: "VirtualMachines");

        migrationBuilder.DropTable(
            name: "Roles");

        migrationBuilder.DropTable(
            name: "Hosts");

        migrationBuilder.DropTable(
            name: "Users");
    }
}
