using System;
using HvShop.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

namespace HvShop.Infrastructure.Migrations;

[DbContext(typeof(ApplicationDbContext))]
partial class ApplicationDbContextModelSnapshot : ModelSnapshot
{
    protected override void BuildModel(ModelBuilder modelBuilder)
    {
#pragma warning disable 612, 618
        modelBuilder
            .HasAnnotation("ProductVersion", "8.0.0")
            .HasAnnotation("Relational:MaxIdentifierLength", 63);

        NpgsqlModelBuilderExtensions.UseIdentityByDefaultColumns(modelBuilder);

        modelBuilder.Entity("HvShop.Domain.Entities.ApiKey", b =>
        {
            b.Property<Guid>("Id")
                .HasColumnType("uuid");

            b.Property<DateTimeOffset>("CreatedAt")
                .HasColumnType("timestamp with time zone");

            b.Property<string>("HashedKey")
                .IsRequired()
                .HasColumnType("text");

            b.Property<DateTimeOffset?>("LastUsedAt")
                .HasColumnType("timestamp with time zone");

            b.Property<string>("Name")
                .IsRequired()
                .HasColumnType("text");

            b.Property<string>("Role")
                .IsRequired()
                .HasColumnType("text");

            b.Property<Guid>("UserId")
                .HasColumnType("uuid");

            b.HasKey("Id");

            b.HasIndex("HashedKey")
                .IsUnique();

            b.HasIndex("UserId");

            b.ToTable("ApiKeys");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.AuditLog", b =>
        {
            b.Property<Guid>("Id")
                .HasColumnType("uuid");

            b.Property<Guid?>("ActorApiKeyId")
                .HasColumnType("uuid");

            b.Property<Guid?>("ActorUserId")
                .HasColumnType("uuid");

            b.Property<string>("Action")
                .IsRequired()
                .HasColumnType("text");

            b.Property<string>("DetailsJson")
                .IsRequired()
                .HasColumnType("text");

            b.Property<string>("Ip")
                .HasColumnType("text");

            b.Property<Guid?>("TargetId")
                .HasColumnType("uuid");

            b.Property<string>("TargetType")
                .IsRequired()
                .HasColumnType("text");

            b.Property<DateTimeOffset>("Timestamp")
                .HasColumnType("timestamp with time zone");

            b.HasKey("Id");

            b.HasIndex("ActorApiKeyId");

            b.HasIndex("ActorUserId");

            b.ToTable("AuditLogs");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.Host", b =>
        {
            b.Property<Guid>("Id")
                .HasColumnType("uuid");

            b.Property<string>("AgentVersion")
                .IsRequired()
                .HasColumnType("text");

            b.Property<string>("Fqdn")
                .HasColumnType("text");

            b.Property<string>("Hostname")
                .IsRequired()
                .HasColumnType("text");

            b.Property<string>("HypervVersion")
                .IsRequired()
                .HasColumnType("text");

            b.Property<string>("Ip")
                .IsRequired()
                .HasColumnType("text");

            b.Property<DateTimeOffset?>("LastSeenAt")
                .HasColumnType("timestamp with time zone");

            b.Property<string>("Os")
                .IsRequired()
                .HasColumnType("text");

            b.Property<string>("Status")
                .IsRequired()
                .HasColumnType("text");

            b.Property<int>("TotalCpuCores")
                .HasColumnType("integer");

            b.Property<int>("TotalRamMb")
                .HasColumnType("integer");

            b.Property<int>("TotalStorageGb")
                .HasColumnType("integer");

            b.HasKey("Id");

            b.HasIndex("Hostname")
                .IsUnique();

            b.ToTable("Hosts");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.HostMetric", b =>
        {
            b.Property<Guid>("Id")
                .HasColumnType("uuid");

            b.Property<double>("CpuPct")
                .HasColumnType("double precision");

            b.Property<Guid>("HostId")
                .HasColumnType("uuid");

            b.Property<double>("MemPct")
                .HasColumnType("double precision");

            b.Property<int>("MemUsedMb")
                .HasColumnType("integer");

            b.Property<double>("StorageUsedGb")
                .HasColumnType("double precision");

            b.Property<DateTimeOffset>("Ts")
                .HasColumnType("timestamp with time zone");

            b.HasKey("Id");

            b.HasIndex("HostId");

            b.ToTable("HostMetrics");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.Image", b =>
        {
            b.Property<Guid>("Id")
                .HasColumnType("uuid");

            b.Property<string>("DefaultCredentialsHint")
                .HasColumnType("text");

            b.Property<string>("Name")
                .IsRequired()
                .HasColumnType("text");

            b.Property<string>("OsType")
                .IsRequired()
                .HasColumnType("text");

            b.Property<string>("PathOrCatalogId")
                .IsRequired()
                .HasColumnType("text");

            b.Property<string>("Version")
                .IsRequired()
                .HasColumnType("text");

            b.HasKey("Id");

            b.ToTable("Images");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.Order", b =>
        {
            b.Property<Guid>("Id")
                .HasColumnType("uuid");

            b.Property<DateTimeOffset>("CreatedAt")
                .HasColumnType("timestamp with time zone");

            b.Property<string>("Currency")
                .IsRequired()
                .HasColumnType("text");

            b.Property<string>("PaymentIntentId")
                .HasColumnType("text");

            b.Property<string>("PaymentProvider")
                .IsRequired()
                .HasColumnType("text");

            b.Property<string>("Status")
                .IsRequired()
                .HasColumnType("text");

            b.Property<long>("TotalCents")
                .HasColumnType("bigint");

            b.Property<Guid>("UserId")
                .HasColumnType("uuid");

            b.HasKey("Id");

            b.HasIndex("UserId");

            b.ToTable("Orders");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.OrderItem", b =>
        {
            b.Property<Guid>("Id")
                .HasColumnType("uuid");

            b.Property<int>("CpuCores")
                .HasColumnType("integer");

            b.Property<Guid?>("HostId")
                .HasColumnType("uuid");

            b.Property<string>("HostnameRequest")
                .HasColumnType("text");

            b.Property<int>("MemoryMb")
                .HasColumnType("integer");

            b.Property<Guid>("OrderId")
                .HasColumnType("uuid");

            b.Property<string>("OsImage")
                .IsRequired()
                .HasColumnType("text");

            b.Property<int>("Quantity")
                .HasColumnType("integer");

            b.Property<int>("StorageGb")
                .HasColumnType("integer");

            b.Property<long>("UnitPriceCents")
                .HasColumnType("bigint");

            b.Property<Guid?>("VmId")
                .HasColumnType("uuid");

            b.HasKey("Id");

            b.HasIndex("HostId");

            b.HasIndex("OrderId");

            b.HasIndex("VmId");

            b.ToTable("OrderItems");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.PricingRule", b =>
        {
            b.Property<Guid>("Id")
                .HasColumnType("uuid");

            b.Property<bool>("Active")
                .HasColumnType("boolean");

            b.Property<long>("CpuPriceCents")
                .HasColumnType("bigint");

            b.Property<string>("Currency")
                .IsRequired()
                .HasColumnType("text");

            b.Property<long>("RamPriceCentsPerGb")
                .HasColumnType("bigint");

            b.Property<long>("StoragePriceCentsPerGb")
                .HasColumnType("bigint");

            b.Property<string>("Name")
                .IsRequired()
                .HasColumnType("text");

            b.HasKey("Id");

            b.ToTable("PricingRules");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.ProvisioningJob", b =>
        {
            b.Property<Guid>("Id")
                .HasColumnType("uuid");

            b.Property<DateTimeOffset?>("FinishedAt")
                .HasColumnType("timestamp with time zone");

            b.Property<Guid>("HostId")
                .HasColumnType("uuid");

            b.Property<string>("PayloadJson")
                .IsRequired()
                .HasColumnType("text");

            b.Property<string>("Status")
                .IsRequired()
                .HasColumnType("text");

            b.Property<DateTimeOffset?>("StartedAt")
                .HasColumnType("timestamp with time zone");

            b.Property<string>("Type")
                .IsRequired()
                .HasColumnType("text");

            b.Property<Guid?>("VmId")
                .HasColumnType("uuid");

            b.Property<DateTimeOffset>("CreatedAt")
                .HasColumnType("timestamp with time zone");

            b.Property<string>("Error")
                .HasColumnType("text");

            b.HasKey("Id");

            b.HasIndex("HostId");

            b.HasIndex("VmId");

            b.ToTable("ProvisioningJobs");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.Role", b =>
        {
            b.Property<Guid>("Id")
                .HasColumnType("uuid");

            b.Property<string>("Name")
                .IsRequired()
                .HasColumnType("text");

            b.HasKey("Id");

            b.ToTable("Roles");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.RolePermission", b =>
        {
            b.Property<Guid>("Id")
                .HasColumnType("uuid");

            b.Property<string>("Permission")
                .IsRequired()
                .HasColumnType("text");

            b.Property<Guid>("RoleId")
                .HasColumnType("uuid");

            b.HasKey("Id");

            b.HasIndex("RoleId");

            b.ToTable("RolePermissions");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.User", b =>
        {
            b.Property<Guid>("Id")
                .HasColumnType("uuid");

            b.Property<string>("Email")
                .IsRequired()
                .HasColumnType("text");

            b.Property<string>("ExternalIdpSub")
                .HasColumnType("text");

            b.Property<string>("PasswordHash")
                .HasColumnType("text");

            b.Property<string>("Role")
                .IsRequired()
                .HasColumnType("text");

            b.HasKey("Id");

            b.HasIndex("Email")
                .IsUnique();

            b.ToTable("Users");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.VirtualMachine", b =>
        {
            b.Property<Guid>("Id")
                .HasColumnType("uuid");

            b.Property<int>("CpuCores")
                .HasColumnType("integer");

            b.Property<DateTimeOffset>("CreatedAt")
                .HasColumnType("timestamp with time zone");

            b.Property<Guid>("HostId")
                .HasColumnType("uuid");

            b.Property<string>("Ip")
                .HasColumnType("text");

            b.Property<int>("MemoryMb")
                .HasColumnType("integer");

            b.Property<string>("Name")
                .IsRequired()
                .HasColumnType("text");

            b.Property<Guid?>("OwnerId")
                .HasColumnType("uuid");

            b.Property<string>("OsImage")
                .IsRequired()
                .HasColumnType("text");

            b.Property<string>("State")
                .IsRequired()
                .HasColumnType("text");

            b.Property<int>("StorageGb")
                .HasColumnType("integer");

            b.Property<DateTimeOffset>("UpdatedAt")
                .HasColumnType("timestamp with time zone");

            b.HasKey("Id");

            b.HasIndex("HostId");

            b.HasIndex("OwnerId");

            b.ToTable("VirtualMachines");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.AuditLog", b =>
        {
            b.HasOne("HvShop.Domain.Entities.ApiKey", "ActorApiKey")
                .WithMany()
                .HasForeignKey("ActorApiKeyId")
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne("HvShop.Domain.Entities.User", "ActorUser")
                .WithMany()
                .HasForeignKey("ActorUserId")
                .OnDelete(DeleteBehavior.Restrict);

            b.Navigation("ActorApiKey");

            b.Navigation("ActorUser");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.ApiKey", b =>
        {
            b.HasOne("HvShop.Domain.Entities.User", "User")
                .WithMany("ApiKeys")
                .HasForeignKey("UserId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            b.Navigation("User");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.HostMetric", b =>
        {
            b.HasOne("HvShop.Domain.Entities.Host", "Host")
                .WithMany("Metrics")
                .HasForeignKey("HostId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            b.Navigation("Host");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.Order", b =>
        {
            b.HasOne("HvShop.Domain.Entities.User", "User")
                .WithMany("Orders")
                .HasForeignKey("UserId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            b.Navigation("User");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.OrderItem", b =>
        {
            b.HasOne("HvShop.Domain.Entities.Host", "Host")
                .WithMany()
                .HasForeignKey("HostId")
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne("HvShop.Domain.Entities.Order", "Order")
                .WithMany("Items")
                .HasForeignKey("OrderId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            b.HasOne("HvShop.Domain.Entities.VirtualMachine", "Vm")
                .WithMany()
                .HasForeignKey("VmId")
                .OnDelete(DeleteBehavior.Restrict);

            b.Navigation("Host");

            b.Navigation("Order");

            b.Navigation("Vm");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.ProvisioningJob", b =>
        {
            b.HasOne("HvShop.Domain.Entities.Host", "Host")
                .WithMany("Jobs")
                .HasForeignKey("HostId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            b.HasOne("HvShop.Domain.Entities.VirtualMachine", "Vm")
                .WithMany("Jobs")
                .HasForeignKey("VmId")
                .OnDelete(DeleteBehavior.Restrict);

            b.Navigation("Host");

            b.Navigation("Vm");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.RolePermission", b =>
        {
            b.HasOne("HvShop.Domain.Entities.Role", "Role")
                .WithMany("Permissions")
                .HasForeignKey("RoleId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            b.Navigation("Role");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.VirtualMachine", b =>
        {
            b.HasOne("HvShop.Domain.Entities.Host", "Host")
                .WithMany("Vms")
                .HasForeignKey("HostId")
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            b.HasOne("HvShop.Domain.Entities.User", "Owner")
                .WithMany()
                .HasForeignKey("OwnerId")
                .OnDelete(DeleteBehavior.Restrict);

            b.Navigation("Host");

            b.Navigation("Owner");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.Host", b =>
        {
            b.Navigation("Jobs");

            b.Navigation("Metrics");

            b.Navigation("Vms");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.Order", b =>
        {
            b.Navigation("Items");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.Role", b =>
        {
            b.Navigation("Permissions");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.User", b =>
        {
            b.Navigation("ApiKeys");

            b.Navigation("Orders");
        });

        modelBuilder.Entity("HvShop.Domain.Entities.VirtualMachine", b =>
        {
            b.Navigation("Jobs");
        });
#pragma warning restore 612, 618
    }
}
