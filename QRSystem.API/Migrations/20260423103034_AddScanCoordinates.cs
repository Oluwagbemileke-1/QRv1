using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QRSystem.API.Migrations
{
    /// <inheritdoc />
    public partial class AddScanCoordinates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "Latitude",
                table: "ScanAttempts",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "Longitude",
                table: "ScanAttempts",
                type: "double precision",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "ScanAttempts");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "ScanAttempts");
        }
    }
}
