frappe.ui.form.on("S3 Integration Settings", {
	refresh(frm) {
		frm.trigger("set_status_color");

		if (!frm.is_dirty()) {
			frm.add_custom_button(__("Test Connection"), function () {
				frm.trigger("test_connection");
			});
		}

		frm.set_query("single_file_to_migrate", () => {
			return {
				filters: [
					["File", "is_folder", "=", 0],
					["File", "file_url", "not like", "/s3/%"],
					["File", "file_url", "not like", "http://%"],
					["File", "file_url", "not like", "https://%"],
				],
			};
		});
	},

	after_save(frm) {
		frm.trigger("set_status_color");
	},

	set_status_color(frm) {
		if (!frm.doc.status) return;

		frm.page.clear_indicator();
		if (frm.doc.status === "Configured & Connected") {
			frm.page.set_indicator(frm.doc.status, "green");
		} else {
			frm.page.set_indicator(frm.doc.status, "red");
		}
	},

	test_connection(frm) {
		if (frm.is_dirty()) {
			frappe.msgprint(__("Please save the document before testing the connection."));
			return;
		}

		frappe.call({
			method: "erpnext_s3_integration.erpnext_s3_integration.doctype.s3_integration_settings.s3_integration_settings.test_s3_connection",
			callback: function (r) {
				if (r.message) {
					if (r.message.success) {
						frappe.msgprint({
							title: __("Success"),
							indicator: "green",
							message: r.message.message,
						});
						frm.set_value("status", "Configured & Connected");
					} else {
						frappe.msgprint({
							title: __("Connection Failed"),
							indicator: "red",
							message: r.message.message,
						});
						frm.set_value("status", "Misconfigured");
					}
					frm.save().then(() => {
						frm.trigger("set_status_color");
					});
				}
			},
		});
	},

	migrate_existing_files(frm) {
		frappe.confirm(
			__(
				"Are you sure you want to start migrating existing files to S3? This process will run in the background."
			),
			() => {
				frappe.call({
					method: "erpnext_s3_integration.migration.start_migration",
					args: {
						only_unmigrated: frm.doc.migrate_only_unmigrated,
					},
					callback: function (r) {
						if (!r.exc) {
							frappe.show_alert({
								message: __(r.message),
								indicator: "green",
							});
						}
					},
				});
			}
		);
	},

	migrate_single_file(frm) {
		if (!frm.doc.single_file_to_migrate) {
			frappe.msgprint(__("Please select a File to Migrate first."));
			return;
		}

		frappe.call({
			method: "erpnext_s3_integration.migration.migrate_single_file",
			args: {
				file_name: frm.doc.single_file_to_migrate,
				dry_run: frm.doc.single_file_dry_run,
			},
			freeze: true,
			freeze_message: __("Checking file..."),
			callback: function (r) {
				if (r.exc || !r.message) return;

				const result = r.message;
				const rows = Object.entries(result)
					.map(([key, value]) => `<tr><td><b>${frappe.utils.escape_html(key)}</b></td><td>${frappe.utils.escape_html(String(value))}</td></tr>`)
					.join("");

				const indicator = { migrated: "green", dry_run_no_changes_made: "blue" }[result.status] || "red";

				frappe.msgprint({
					title: __("Single File Migration Result"),
					indicator: indicator,
					message: `<table class="table table-bordered">${rows}</table>`,
				});

				if (result.status === "migrated") {
					frm.set_value("single_file_to_migrate", "");
				}
			},
		});
	},

	take_backup_and_sync(frm) {
		frappe.confirm(
			__(
				"Are you sure you want to take a new backup and sync it to S3? This process will run in the background."
			),
			() => {
				frappe.call({
					method: "erpnext_s3_integration.erpnext_s3_integration.doctype.s3_integration_settings.s3_integration_settings.take_backup_and_sync",
					callback: function (r) {
						if (!r.exc) {
							frappe.show_alert({
								message: __(r.message),
								indicator: "green",
							});
						}
					},
				});
			}
		);
	},
});
