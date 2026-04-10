using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QRSystem.API.Migrations
{
    /// <inheritdoc />
    public partial class SecondCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "SessionId",
                table: "ScanAttempts",
                newName: "EventId");

            migrationBuilder.RenameIndex(
                name: "IX_ScanAttempts_IpAddress_SessionId",
                table: "ScanAttempts",
                newName: "IX_ScanAttempts_IpAddress_EventId");

            migrationBuilder.RenameColumn(
                name: "SessionId",
                table: "QrCodes",
                newName: "EventId");

            migrationBuilder.RenameIndex(
                name: "IX_QrCodes_SessionId_IsActive",
                table: "QrCodes",
                newName: "IX_QrCodes_EventId_IsActive");

            migrationBuilder.RenameColumn(
                name: "SessionId",
                table: "FraudLogs",
                newName: "EventId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "EventId",
                table: "ScanAttempts",
                newName: "SessionId");

            migrationBuilder.RenameIndex(
                name: "IX_ScanAttempts_IpAddress_EventId",
                table: "ScanAttempts",
                newName: "IX_ScanAttempts_IpAddress_SessionId");

            migrationBuilder.RenameColumn(
                name: "EventId",
                table: "QrCodes",
                newName: "SessionId");

            migrationBuilder.RenameIndex(
                name: "IX_QrCodes_EventId_IsActive",
                table: "QrCodes",
                newName: "IX_QrCodes_SessionId_IsActive");

            migrationBuilder.RenameColumn(
                name: "EventId",
                table: "FraudLogs",
                newName: "SessionId");
        }
    }
}
