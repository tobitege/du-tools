namespace ItemExportWin
{
    partial class MainForm
    {
        private System.ComponentModel.IContainer components = null;

        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        private void InitializeComponent()
        {
            txtQueueing = new System.Windows.Forms.TextBox();
            lblQueueing = new System.Windows.Forms.Label();
            btnTest = new System.Windows.Forms.Button();
            memoLog = new System.Windows.Forms.TextBox();
            grpProps = new System.Windows.Forms.GroupBox();
            propsPanel = new System.Windows.Forms.Panel();
            chkPropDisplayName = new System.Windows.Forms.CheckBox();
            chkPropUnitVolume = new System.Windows.Forms.CheckBox();
            chkPropUnitMass = new System.Windows.Forms.CheckBox();
            chkPropScale = new System.Windows.Forms.CheckBox();
            chkPropLevel = new System.Windows.Forms.CheckBox();
            chkPropSubdescription = new System.Windows.Forms.CheckBox();
            chkPropHitpoints = new System.Windows.Forms.CheckBox();
            chkPropRequiredTalentsForUse = new System.Windows.Forms.CheckBox();
            grpDetails = new System.Windows.Forms.GroupBox();
            panel1 = new System.Windows.Forms.Panel();
            chkAutoOverwrite = new System.Windows.Forms.CheckBox();
            lblExportSchematics = new System.Windows.Forms.Label();
            lblExportTalents = new System.Windows.Forms.Label();
            chkLangEn = new System.Windows.Forms.CheckBox();
            label2 = new System.Windows.Forms.Label();
            label1 = new System.Windows.Forms.Label();
            lblOutYaml = new System.Windows.Forms.Label();
            txtOutYaml = new System.Windows.Forms.TextBox();
            lblOutJson = new System.Windows.Forms.Label();
            txtOutJson = new System.Windows.Forms.TextBox();
            chkExportYaml = new System.Windows.Forms.CheckBox();
            chkRecipesTransform = new System.Windows.Forms.CheckBox();
            btnExport = new System.Windows.Forms.Button();
            chkExportSchematicsJson = new System.Windows.Forms.CheckBox();
            chkExportTalentsJson = new System.Windows.Forms.CheckBox();
            chkExportSchematics = new System.Windows.Forms.CheckBox();
            chkExportTalents = new System.Windows.Forms.CheckBox();
            chkRecipesNanocraftable = new System.Windows.Forms.CheckBox();
            chkSizeXXXL = new System.Windows.Forms.CheckBox();
            chkSizeXXL = new System.Windows.Forms.CheckBox();
            chkSizeXL = new System.Windows.Forms.CheckBox();
            chkSizeL = new System.Windows.Forms.CheckBox();
            chkSizeM = new System.Windows.Forms.CheckBox();
            chkSizeS = new System.Windows.Forms.CheckBox();
            chkSizeXS = new System.Windows.Forms.CheckBox();
            lblSize = new System.Windows.Forms.Label();
            cmbMode = new System.Windows.Forms.ComboBox();
            numTierMax = new System.Windows.Forms.NumericUpDown();
            lblTierMax = new System.Windows.Forms.Label();
            numTierMin = new System.Windows.Forms.NumericUpDown();
            lblTierMin = new System.Windows.Forms.Label();
            numRecipesTimeMax = new System.Windows.Forms.NumericUpDown();
            lblRecipesTimeMax = new System.Windows.Forms.Label();
            numRecipesLimit = new System.Windows.Forms.NumericUpDown();
            lblRecipesLimit = new System.Windows.Forms.Label();
            lblLog = new System.Windows.Forms.Label();
            lblFirstStep = new System.Windows.Forms.Label();
            grpLookups = new System.Windows.Forms.GroupBox();
            panel2 = new System.Windows.Forms.Panel();
            btnMakeRecipeItems = new System.Windows.Forms.Button();
            btnItemLookupName = new System.Windows.Forms.Button();
            editItemLookupName = new System.Windows.Forms.TextBox();
            lblItemLookupName = new System.Windows.Forms.Label();
            btnItemLookupId = new System.Windows.Forms.Button();
            editItemLookupId = new System.Windows.Forms.NumericUpDown();
            lblItemLookupId = new System.Windows.Forms.Label();
            progress = new System.Windows.Forms.ProgressBar();
            grpProps.SuspendLayout();
            propsPanel.SuspendLayout();
            grpDetails.SuspendLayout();
            panel1.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)numTierMax).BeginInit();
            ((System.ComponentModel.ISupportInitialize)numTierMin).BeginInit();
            ((System.ComponentModel.ISupportInitialize)numRecipesTimeMax).BeginInit();
            ((System.ComponentModel.ISupportInitialize)numRecipesLimit).BeginInit();
            grpLookups.SuspendLayout();
            panel2.SuspendLayout();
            ((System.ComponentModel.ISupportInitialize)editItemLookupId).BeginInit();
            SuspendLayout();
            // 
            // txtQueueing
            // 
            txtQueueing.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
            txtQueueing.Location = new System.Drawing.Point(132, 12);
            txtQueueing.Name = "txtQueueing";
            txtQueueing.Size = new System.Drawing.Size(820, 23);
            txtQueueing.TabIndex = 0;
            txtQueueing.Text = "http://localhost:9630";
            // 
            // lblQueueing
            // 
            lblQueueing.AutoSize = true;
            lblQueueing.Location = new System.Drawing.Point(18, 15);
            lblQueueing.Name = "lblQueueing";
            lblQueueing.Size = new System.Drawing.Size(101, 15);
            lblQueueing.TabIndex = 1;
            lblQueueing.Text = "Queueing BaseUrl";
            // 
            // btnTest
            // 
            btnTest.Location = new System.Drawing.Point(132, 41);
            btnTest.Name = "btnTest";
            btnTest.Size = new System.Drawing.Size(110, 27);
            btnTest.TabIndex = 2;
            btnTest.Text = "Connect!";
            btnTest.UseVisualStyleBackColor = true;
            btnTest.Click += btnTest_Click;
            // 
            // memoLog
            // 
            memoLog.Anchor = System.Windows.Forms.AnchorStyles.Top | System.Windows.Forms.AnchorStyles.Bottom | System.Windows.Forms.AnchorStyles.Left | System.Windows.Forms.AnchorStyles.Right;
            memoLog.BorderStyle = System.Windows.Forms.BorderStyle.FixedSingle;
            memoLog.Location = new System.Drawing.Point(12, 503);
            memoLog.Multiline = true;
            memoLog.Name = "memoLog";
            memoLog.ReadOnly = true;
            memoLog.ScrollBars = System.Windows.Forms.ScrollBars.Both;
            memoLog.Size = new System.Drawing.Size(947, 249);
            memoLog.TabIndex = 9;
            // 
            // grpProps
            // 
            grpProps.Controls.Add(propsPanel);
            grpProps.Location = new System.Drawing.Point(8, 277);
            grpProps.Name = "grpProps";
            grpProps.Size = new System.Drawing.Size(465, 191);
            grpProps.TabIndex = 13;
            grpProps.TabStop = false;
            grpProps.Text = " Required properties (filters the Items list, not Recipes!) ";
            // 
            // propsPanel
            // 
            propsPanel.AutoScroll = true;
            propsPanel.Controls.Add(chkPropDisplayName);
            propsPanel.Controls.Add(chkPropUnitVolume);
            propsPanel.Controls.Add(chkPropUnitMass);
            propsPanel.Controls.Add(chkPropScale);
            propsPanel.Controls.Add(chkPropLevel);
            propsPanel.Controls.Add(chkPropSubdescription);
            propsPanel.Controls.Add(chkPropHitpoints);
            propsPanel.Controls.Add(chkPropRequiredTalentsForUse);
            propsPanel.Dock = System.Windows.Forms.DockStyle.Fill;
            propsPanel.Location = new System.Drawing.Point(3, 19);
            propsPanel.Name = "propsPanel";
            propsPanel.Size = new System.Drawing.Size(459, 169);
            propsPanel.TabIndex = 8;
            // 
            // chkPropDisplayName
            // 
            chkPropDisplayName.AutoSize = true;
            chkPropDisplayName.Location = new System.Drawing.Point(7, 13);
            chkPropDisplayName.Name = "chkPropDisplayName";
            chkPropDisplayName.Size = new System.Drawing.Size(95, 19);
            chkPropDisplayName.TabIndex = 1;
            chkPropDisplayName.Text = "displayName";
            chkPropDisplayName.UseVisualStyleBackColor = true;
            // 
            // chkPropUnitVolume
            // 
            chkPropUnitVolume.AutoSize = true;
            chkPropUnitVolume.Location = new System.Drawing.Point(7, 113);
            chkPropUnitVolume.Name = "chkPropUnitVolume";
            chkPropUnitVolume.Size = new System.Drawing.Size(167, 19);
            chkPropUnitVolume.TabIndex = 7;
            chkPropUnitVolume.Text = "unitVolume or maxVolume";
            chkPropUnitVolume.UseVisualStyleBackColor = true;
            // 
            // chkPropUnitMass
            // 
            chkPropUnitMass.AutoSize = true;
            chkPropUnitMass.Location = new System.Drawing.Point(7, 88);
            chkPropUnitMass.Name = "chkPropUnitMass";
            chkPropUnitMass.Size = new System.Drawing.Size(74, 19);
            chkPropUnitMass.TabIndex = 6;
            chkPropUnitMass.Text = "unitMass";
            chkPropUnitMass.UseVisualStyleBackColor = true;
            // 
            // chkPropScale
            // 
            chkPropScale.AutoSize = true;
            chkPropScale.Location = new System.Drawing.Point(7, 38);
            chkPropScale.Name = "chkPropScale";
            chkPropScale.Size = new System.Drawing.Size(46, 19);
            chkPropScale.TabIndex = 4;
            chkPropScale.Text = "Size";
            chkPropScale.UseVisualStyleBackColor = true;
            // 
            // chkPropLevel
            // 
            chkPropLevel.AutoSize = true;
            chkPropLevel.Location = new System.Drawing.Point(7, 63);
            chkPropLevel.Name = "chkPropLevel";
            chkPropLevel.Size = new System.Drawing.Size(45, 19);
            chkPropLevel.TabIndex = 5;
            chkPropLevel.Text = "Tier";
            chkPropLevel.UseVisualStyleBackColor = true;
            // 
            // chkPropSubdescription
            // 
            chkPropSubdescription.AutoSize = true;
            chkPropSubdescription.Location = new System.Drawing.Point(299, 13);
            chkPropSubdescription.Name = "chkPropSubdescription";
            chkPropSubdescription.Size = new System.Drawing.Size(104, 19);
            chkPropSubdescription.TabIndex = 8;
            chkPropSubdescription.Text = "subdescription";
            chkPropSubdescription.UseVisualStyleBackColor = true;
            // 
            // chkPropHitpoints
            // 
            chkPropHitpoints.AutoSize = true;
            chkPropHitpoints.Location = new System.Drawing.Point(299, 38);
            chkPropHitpoints.Name = "chkPropHitpoints";
            chkPropHitpoints.Size = new System.Drawing.Size(73, 19);
            chkPropHitpoints.TabIndex = 9;
            chkPropHitpoints.Text = "hitpoints";
            chkPropHitpoints.UseVisualStyleBackColor = true;
            // 
            // chkPropRequiredTalentsForUse
            // 
            chkPropRequiredTalentsForUse.AutoSize = true;
            chkPropRequiredTalentsForUse.Location = new System.Drawing.Point(299, 63);
            chkPropRequiredTalentsForUse.Name = "chkPropRequiredTalentsForUse";
            chkPropRequiredTalentsForUse.Size = new System.Drawing.Size(142, 19);
            chkPropRequiredTalentsForUse.TabIndex = 10;
            chkPropRequiredTalentsForUse.Text = "requiredTalentsForUse";
            chkPropRequiredTalentsForUse.UseVisualStyleBackColor = true;
            // 
            // grpDetails
            // 
            grpDetails.Controls.Add(panel1);
            grpDetails.Location = new System.Drawing.Point(490, 51);
            grpDetails.Name = "grpDetails";
            grpDetails.Size = new System.Drawing.Size(465, 446);
            grpDetails.TabIndex = 14;
            grpDetails.TabStop = false;
            grpDetails.Text = "Export ";
            // 
            // panel1
            // 
            panel1.Controls.Add(chkAutoOverwrite);
            panel1.Controls.Add(lblExportSchematics);
            panel1.Controls.Add(lblExportTalents);
            panel1.Controls.Add(chkLangEn);
            panel1.Controls.Add(label2);
            panel1.Controls.Add(label1);
            panel1.Controls.Add(lblOutYaml);
            panel1.Controls.Add(txtOutYaml);
            panel1.Controls.Add(lblOutJson);
            panel1.Controls.Add(txtOutJson);
            panel1.Controls.Add(chkExportYaml);
            panel1.Controls.Add(chkRecipesTransform);
            panel1.Controls.Add(btnExport);
            panel1.Controls.Add(chkExportSchematicsJson);
            panel1.Controls.Add(chkExportTalentsJson);
            panel1.Controls.Add(chkExportSchematics);
            panel1.Controls.Add(chkExportTalents);
            panel1.Controls.Add(chkRecipesNanocraftable);
            panel1.Controls.Add(chkSizeXXXL);
            panel1.Controls.Add(chkSizeXXL);
            panel1.Controls.Add(chkSizeXL);
            panel1.Controls.Add(chkSizeL);
            panel1.Controls.Add(chkSizeM);
            panel1.Controls.Add(chkSizeS);
            panel1.Controls.Add(chkSizeXS);
            panel1.Controls.Add(lblSize);
            panel1.Controls.Add(cmbMode);
            panel1.Controls.Add(numTierMax);
            panel1.Controls.Add(lblTierMax);
            panel1.Controls.Add(numTierMin);
            panel1.Controls.Add(lblTierMin);
            panel1.Controls.Add(numRecipesTimeMax);
            panel1.Controls.Add(lblRecipesTimeMax);
            panel1.Controls.Add(numRecipesLimit);
            panel1.Controls.Add(lblRecipesLimit);
            panel1.Dock = System.Windows.Forms.DockStyle.Fill;
            panel1.Location = new System.Drawing.Point(3, 19);
            panel1.Name = "panel1";
            panel1.Size = new System.Drawing.Size(459, 424);
            panel1.TabIndex = 0;
            // 
            // chkAutoOverwrite
            // 
            chkAutoOverwrite.AutoSize = true;
            chkAutoOverwrite.Checked = true;
            chkAutoOverwrite.CheckState = System.Windows.Forms.CheckState.Checked;
            chkAutoOverwrite.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            chkAutoOverwrite.Location = new System.Drawing.Point(9, 394);
            chkAutoOverwrite.Name = "chkAutoOverwrite";
            chkAutoOverwrite.Size = new System.Drawing.Size(200, 19);
            chkAutoOverwrite.TabIndex = 33;
            chkAutoOverwrite.Text = "Auto-overwrite existing file(s)?";
            chkAutoOverwrite.UseVisualStyleBackColor = true;
            // 
            // lblExportSchematics
            // 
            lblExportSchematics.AutoSize = true;
            lblExportSchematics.Location = new System.Drawing.Point(25, 361);
            lblExportSchematics.Name = "lblExportSchematics";
            lblExportSchematics.Size = new System.Drawing.Size(104, 15);
            lblExportSchematics.TabIndex = 29;
            lblExportSchematics.Text = "Export Schematics";
            // 
            // lblExportTalents
            // 
            lblExportTalents.AutoSize = true;
            lblExportTalents.Location = new System.Drawing.Point(25, 338);
            lblExportTalents.Name = "lblExportTalents";
            lblExportTalents.Size = new System.Drawing.Size(80, 15);
            lblExportTalents.TabIndex = 26;
            lblExportTalents.Text = "Export Talents";
            // 
            // chkLangEn
            // 
            chkLangEn.AutoSize = true;
            chkLangEn.Checked = true;
            chkLangEn.CheckState = System.Windows.Forms.CheckState.Checked;
            chkLangEn.Location = new System.Drawing.Point(282, 10);
            chkLangEn.Name = "chkLangEn";
            chkLangEn.Size = new System.Drawing.Size(146, 19);
            chkLangEn.TabIndex = 32;
            chkLangEn.Text = "incl. Sub-Descriptions?";
            chkLangEn.UseVisualStyleBackColor = true;
            // 
            // label2
            // 
            label2.AutoSize = true;
            label2.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            label2.Location = new System.Drawing.Point(7, 180);
            label2.Name = "label2";
            label2.Size = new System.Drawing.Size(53, 15);
            label2.TabIndex = 7;
            label2.Text = "FILTERS:";
            // 
            // label1
            // 
            label1.AutoSize = true;
            label1.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            label1.Location = new System.Drawing.Point(9, 11);
            label1.Name = "label1";
            label1.Size = new System.Drawing.Size(96, 15);
            label1.TabIndex = 0;
            label1.Text = "What to export:";
            // 
            // lblOutYaml
            // 
            lblOutYaml.AutoSize = true;
            lblOutYaml.Location = new System.Drawing.Point(7, 90);
            lblOutYaml.Name = "lblOutYaml";
            lblOutYaml.Size = new System.Drawing.Size(106, 15);
            lblOutYaml.TabIndex = 4;
            lblOutYaml.Text = "Output YAML Path";
            // 
            // txtOutYaml
            // 
            txtOutYaml.Location = new System.Drawing.Point(8, 108);
            txtOutYaml.Name = "txtOutYaml";
            txtOutYaml.Size = new System.Drawing.Size(436, 23);
            txtOutYaml.TabIndex = 5;
            txtOutYaml.Text = "itembank.yaml";
            // 
            // lblOutJson
            // 
            lblOutJson.AutoSize = true;
            lblOutJson.Location = new System.Drawing.Point(4, 46);
            lblOutJson.Name = "lblOutJson";
            lblOutJson.Size = new System.Drawing.Size(103, 15);
            lblOutJson.TabIndex = 2;
            lblOutJson.Text = "Output JSON Path";
            // 
            // txtOutJson
            // 
            txtOutJson.Location = new System.Drawing.Point(7, 64);
            txtOutJson.Name = "txtOutJson";
            txtOutJson.Size = new System.Drawing.Size(437, 23);
            txtOutJson.TabIndex = 3;
            txtOutJson.Text = "itembank.json";
            // 
            // chkExportYaml
            // 
            chkExportYaml.AutoSize = true;
            chkExportYaml.Location = new System.Drawing.Point(9, 314);
            chkExportYaml.Name = "chkExportYaml";
            chkExportYaml.Size = new System.Drawing.Size(157, 19);
            chkExportYaml.TabIndex = 25;
            chkExportYaml.Text = "Extra exports (more files)";
            chkExportYaml.UseVisualStyleBackColor = true;
            chkExportYaml.CheckedChanged += chkExportYaml_CheckedChanged;
            // 
            // chkRecipesTransform
            // 
            chkRecipesTransform.AutoSize = true;
            chkRecipesTransform.Checked = true;
            chkRecipesTransform.CheckState = System.Windows.Forms.CheckState.Checked;
            chkRecipesTransform.Location = new System.Drawing.Point(8, 151);
            chkRecipesTransform.Name = "chkRecipesTransform";
            chkRecipesTransform.Size = new System.Drawing.Size(259, 19);
            chkRecipesTransform.TabIndex = 6;
            chkRecipesTransform.Text = "Transform to `DU Industry Tool` JSON format";
            chkRecipesTransform.UseVisualStyleBackColor = true;
            // 
            // btnExport
            // 
            btnExport.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            btnExport.Location = new System.Drawing.Point(334, 388);
            btnExport.Name = "btnExport";
            btnExport.Size = new System.Drawing.Size(110, 27);
            btnExport.TabIndex = 32;
            btnExport.Text = "&Export!";
            btnExport.UseVisualStyleBackColor = true;
            btnExport.Click += btnExport_Click;
            // 
            // chkExportSchematicsJson
            // 
            chkExportSchematicsJson.AutoSize = true;
            chkExportSchematicsJson.Checked = true;
            chkExportSchematicsJson.CheckState = System.Windows.Forms.CheckState.Checked;
            chkExportSchematicsJson.Enabled = false;
            chkExportSchematicsJson.Location = new System.Drawing.Point(246, 360);
            chkExportSchematicsJson.Name = "chkExportSchematicsJson";
            chkExportSchematicsJson.Size = new System.Drawing.Size(54, 19);
            chkExportSchematicsJson.TabIndex = 31;
            chkExportSchematicsJson.Text = "JSON";
            chkExportSchematicsJson.UseVisualStyleBackColor = true;
            // 
            // chkExportTalentsJson
            // 
            chkExportTalentsJson.AutoSize = true;
            chkExportTalentsJson.Checked = true;
            chkExportTalentsJson.CheckState = System.Windows.Forms.CheckState.Checked;
            chkExportTalentsJson.Enabled = false;
            chkExportTalentsJson.Location = new System.Drawing.Point(246, 337);
            chkExportTalentsJson.Name = "chkExportTalentsJson";
            chkExportTalentsJson.Size = new System.Drawing.Size(54, 19);
            chkExportTalentsJson.TabIndex = 28;
            chkExportTalentsJson.Text = "JSON";
            chkExportTalentsJson.UseVisualStyleBackColor = true;
            // 
            // chkExportSchematics
            // 
            chkExportSchematics.AutoSize = true;
            chkExportSchematics.Enabled = false;
            chkExportSchematics.Location = new System.Drawing.Point(167, 360);
            chkExportSchematics.Name = "chkExportSchematics";
            chkExportSchematics.Size = new System.Drawing.Size(57, 19);
            chkExportSchematics.TabIndex = 30;
            chkExportSchematics.Text = "YAML";
            chkExportSchematics.UseVisualStyleBackColor = true;
            // 
            // chkExportTalents
            // 
            chkExportTalents.AutoSize = true;
            chkExportTalents.Enabled = false;
            chkExportTalents.Location = new System.Drawing.Point(167, 337);
            chkExportTalents.Name = "chkExportTalents";
            chkExportTalents.Size = new System.Drawing.Size(57, 19);
            chkExportTalents.TabIndex = 27;
            chkExportTalents.Text = "YAML";
            chkExportTalents.UseVisualStyleBackColor = true;
            // 
            // chkRecipesNanocraftable
            // 
            chkRecipesNanocraftable.AutoSize = true;
            chkRecipesNanocraftable.Location = new System.Drawing.Point(8, 207);
            chkRecipesNanocraftable.Name = "chkRecipesNanocraftable";
            chkRecipesNanocraftable.Size = new System.Drawing.Size(127, 19);
            chkRecipesNanocraftable.TabIndex = 8;
            chkRecipesNanocraftable.Text = "Nanocraftable only";
            chkRecipesNanocraftable.UseVisualStyleBackColor = true;
            // 
            // chkSizeXXXL
            // 
            chkSizeXXXL.AutoSize = true;
            chkSizeXXXL.Checked = true;
            chkSizeXXXL.CheckState = System.Windows.Forms.CheckState.Checked;
            chkSizeXXXL.Location = new System.Drawing.Point(105, 279);
            chkSizeXXXL.Name = "chkSizeXXXL";
            chkSizeXXXL.Size = new System.Drawing.Size(53, 19);
            chkSizeXXXL.TabIndex = 20;
            chkSizeXXXL.Text = "XXXL";
            chkSizeXXXL.UseVisualStyleBackColor = true;
            // 
            // chkSizeXXL
            // 
            chkSizeXXL.AutoSize = true;
            chkSizeXXL.Checked = true;
            chkSizeXXL.CheckState = System.Windows.Forms.CheckState.Checked;
            chkSizeXXL.Location = new System.Drawing.Point(53, 279);
            chkSizeXXL.Name = "chkSizeXXL";
            chkSizeXXL.Size = new System.Drawing.Size(46, 19);
            chkSizeXXL.TabIndex = 19;
            chkSizeXXL.Text = "XXL";
            chkSizeXXL.UseVisualStyleBackColor = true;
            // 
            // chkSizeXL
            // 
            chkSizeXL.AutoSize = true;
            chkSizeXL.Checked = true;
            chkSizeXL.CheckState = System.Windows.Forms.CheckState.Checked;
            chkSizeXL.Location = new System.Drawing.Point(8, 279);
            chkSizeXL.Name = "chkSizeXL";
            chkSizeXL.Size = new System.Drawing.Size(39, 19);
            chkSizeXL.TabIndex = 18;
            chkSizeXL.Text = "XL";
            chkSizeXL.UseVisualStyleBackColor = true;
            // 
            // chkSizeL
            // 
            chkSizeL.AutoSize = true;
            chkSizeL.Checked = true;
            chkSizeL.CheckState = System.Windows.Forms.CheckState.Checked;
            chkSizeL.Location = new System.Drawing.Point(134, 254);
            chkSizeL.Name = "chkSizeL";
            chkSizeL.Size = new System.Drawing.Size(32, 19);
            chkSizeL.TabIndex = 17;
            chkSizeL.Text = "L";
            chkSizeL.UseVisualStyleBackColor = true;
            // 
            // chkSizeM
            // 
            chkSizeM.AutoSize = true;
            chkSizeM.Checked = true;
            chkSizeM.CheckState = System.Windows.Forms.CheckState.Checked;
            chkSizeM.Location = new System.Drawing.Point(91, 254);
            chkSizeM.Name = "chkSizeM";
            chkSizeM.Size = new System.Drawing.Size(37, 19);
            chkSizeM.TabIndex = 16;
            chkSizeM.Text = "M";
            chkSizeM.UseVisualStyleBackColor = true;
            // 
            // chkSizeS
            // 
            chkSizeS.AutoSize = true;
            chkSizeS.Checked = true;
            chkSizeS.CheckState = System.Windows.Forms.CheckState.Checked;
            chkSizeS.Location = new System.Drawing.Point(53, 255);
            chkSizeS.Name = "chkSizeS";
            chkSizeS.Size = new System.Drawing.Size(32, 19);
            chkSizeS.TabIndex = 15;
            chkSizeS.Text = "S";
            chkSizeS.UseVisualStyleBackColor = true;
            // 
            // chkSizeXS
            // 
            chkSizeXS.AutoSize = true;
            chkSizeXS.Checked = true;
            chkSizeXS.CheckState = System.Windows.Forms.CheckState.Checked;
            chkSizeXS.Location = new System.Drawing.Point(8, 254);
            chkSizeXS.Name = "chkSizeXS";
            chkSizeXS.Size = new System.Drawing.Size(39, 19);
            chkSizeXS.TabIndex = 14;
            chkSizeXS.Text = "XS";
            chkSizeXS.UseVisualStyleBackColor = true;
            // 
            // lblSize
            // 
            lblSize.AutoSize = true;
            lblSize.Location = new System.Drawing.Point(8, 232);
            lblSize.Name = "lblSize";
            lblSize.Size = new System.Drawing.Size(27, 15);
            lblSize.TabIndex = 13;
            lblSize.Text = "Size";
            // 
            // cmbMode
            // 
            cmbMode.DropDownStyle = System.Windows.Forms.ComboBoxStyle.DropDownList;
            cmbMode.FormattingEnabled = true;
            cmbMode.Items.AddRange(new object[] { "Recipes Only", "Items only", "Items and Recipes" });
            cmbMode.Location = new System.Drawing.Point(114, 8);
            cmbMode.Name = "cmbMode";
            cmbMode.Size = new System.Drawing.Size(130, 23);
            cmbMode.TabIndex = 1;
            // 
            // numTierMax
            // 
            numTierMax.Location = new System.Drawing.Point(368, 278);
            numTierMax.Maximum = new decimal(new int[] { 5, 0, 0, 0 });
            numTierMax.Name = "numTierMax";
            numTierMax.Size = new System.Drawing.Size(40, 23);
            numTierMax.TabIndex = 24;
            // 
            // lblTierMax
            // 
            lblTierMax.AutoSize = true;
            lblTierMax.Location = new System.Drawing.Point(219, 280);
            lblTierMax.Name = "lblTierMax";
            lblTierMax.Size = new System.Drawing.Size(95, 15);
            lblTierMax.TabIndex = 23;
            lblTierMax.Text = "Tier max (0 = all)";
            // 
            // numTierMin
            // 
            numTierMin.Location = new System.Drawing.Point(368, 250);
            numTierMin.Maximum = new decimal(new int[] { 5, 0, 0, 0 });
            numTierMin.Name = "numTierMin";
            numTierMin.Size = new System.Drawing.Size(40, 23);
            numTierMin.TabIndex = 22;
            // 
            // lblTierMin
            // 
            lblTierMin.AutoSize = true;
            lblTierMin.Location = new System.Drawing.Point(219, 256);
            lblTierMin.Name = "lblTierMin";
            lblTierMin.Size = new System.Drawing.Size(93, 15);
            lblTierMin.TabIndex = 21;
            lblTierMin.Text = "Tier min (0 = all)";
            // 
            // numRecipesTimeMax
            // 
            numRecipesTimeMax.Increment = new decimal(new int[] { 60, 0, 0, 0 });
            numRecipesTimeMax.Location = new System.Drawing.Point(368, 180);
            numRecipesTimeMax.Maximum = new decimal(new int[] { int.MaxValue, 0, 0, 0 });
            numRecipesTimeMax.Name = "numRecipesTimeMax";
            numRecipesTimeMax.Size = new System.Drawing.Size(73, 23);
            numRecipesTimeMax.TabIndex = 10;
            // 
            // lblRecipesTimeMax
            // 
            lblRecipesTimeMax.AutoSize = true;
            lblRecipesTimeMax.Location = new System.Drawing.Point(219, 183);
            lblRecipesTimeMax.Name = "lblRecipesTimeMax";
            lblRecipesTimeMax.Size = new System.Drawing.Size(111, 15);
            lblRecipesTimeMax.TabIndex = 9;
            lblRecipesTimeMax.Text = "Max time (seconds)";
            // 
            // numRecipesLimit
            // 
            numRecipesLimit.Location = new System.Drawing.Point(368, 209);
            numRecipesLimit.Maximum = new decimal(new int[] { 1000000, 0, 0, 0 });
            numRecipesLimit.Name = "numRecipesLimit";
            numRecipesLimit.Size = new System.Drawing.Size(73, 23);
            numRecipesLimit.TabIndex = 12;
            // 
            // lblRecipesLimit
            // 
            lblRecipesLimit.AutoSize = true;
            lblRecipesLimit.Location = new System.Drawing.Point(219, 211);
            lblRecipesLimit.Name = "lblRecipesLimit";
            lblRecipesLimit.Size = new System.Drawing.Size(34, 15);
            lblRecipesLimit.TabIndex = 11;
            lblRecipesLimit.Text = "Limit";
            // 
            // lblLog
            // 
            lblLog.AutoSize = true;
            lblLog.Location = new System.Drawing.Point(12, 478);
            lblLog.Name = "lblLog";
            lblLog.Size = new System.Drawing.Size(84, 15);
            lblLog.TabIndex = 32;
            lblLog.Text = "Log messages:";
            // 
            // lblFirstStep
            // 
            lblFirstStep.AutoSize = true;
            lblFirstStep.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            lblFirstStep.Location = new System.Drawing.Point(19, 47);
            lblFirstStep.Name = "lblFirstStep";
            lblFirstStep.Size = new System.Drawing.Size(61, 15);
            lblFirstStep.TabIndex = 33;
            lblFirstStep.Text = "First step:";
            // 
            // grpLookups
            // 
            grpLookups.Controls.Add(panel2);
            grpLookups.Location = new System.Drawing.Point(8, 74);
            grpLookups.Name = "grpLookups";
            grpLookups.Size = new System.Drawing.Size(465, 191);
            grpLookups.TabIndex = 34;
            grpLookups.TabStop = false;
            grpLookups.Text = "Item Lookup";
            // 
            // panel2
            // 
            panel2.Controls.Add(btnMakeRecipeItems);
            panel2.Controls.Add(btnItemLookupName);
            panel2.Controls.Add(editItemLookupName);
            panel2.Controls.Add(lblItemLookupName);
            panel2.Controls.Add(btnItemLookupId);
            panel2.Controls.Add(editItemLookupId);
            panel2.Controls.Add(lblItemLookupId);
            panel2.Dock = System.Windows.Forms.DockStyle.Fill;
            panel2.Location = new System.Drawing.Point(3, 19);
            panel2.Name = "panel2";
            panel2.Size = new System.Drawing.Size(459, 169);
            panel2.TabIndex = 0;
            // 
            // btnMakeRecipeItems
            // 
            btnMakeRecipeItems.Location = new System.Drawing.Point(130, 128);
            btnMakeRecipeItems.Name = "btnMakeRecipeItems";
            btnMakeRecipeItems.Size = new System.Drawing.Size(190, 23);
            btnMakeRecipeItems.TabIndex = 23;
            btnMakeRecipeItems.Text = "Save RecipeItems YAML";
            btnMakeRecipeItems.UseVisualStyleBackColor = true;
            btnMakeRecipeItems.Click += btnMakeRecipeItems_Click;
            // 
            // btnItemLookupName
            // 
            btnItemLookupName.Location = new System.Drawing.Point(8, 128);
            btnItemLookupName.Name = "btnItemLookupName";
            btnItemLookupName.Size = new System.Drawing.Size(111, 23);
            btnItemLookupName.TabIndex = 22;
            btnItemLookupName.Text = "Lookup Name";
            btnItemLookupName.UseVisualStyleBackColor = true;
            btnItemLookupName.Click += btnItemLookupName_Click;
            // 
            // editItemLookupName
            // 
            editItemLookupName.Location = new System.Drawing.Point(8, 95);
            editItemLookupName.MaxLength = 50;
            editItemLookupName.Name = "editItemLookupName";
            editItemLookupName.PlaceholderText = "Enter full recipe id name";
            editItemLookupName.Size = new System.Drawing.Size(433, 23);
            editItemLookupName.TabIndex = 21;
            editItemLookupName.Text = "AntiGravityGeneratorLarge";
            // 
            // lblItemLookupName
            // 
            lblItemLookupName.AutoSize = true;
            lblItemLookupName.Location = new System.Drawing.Point(8, 67);
            lblItemLookupName.Name = "lblItemLookupName";
            lblItemLookupName.Size = new System.Drawing.Size(177, 15);
            lblItemLookupName.TabIndex = 20;
            lblItemLookupName.Text = "Lookup by Name (exact match):";
            // 
            // btnItemLookupId
            // 
            btnItemLookupId.Location = new System.Drawing.Point(239, 14);
            btnItemLookupId.Name = "btnItemLookupId";
            btnItemLookupId.Size = new System.Drawing.Size(111, 23);
            btnItemLookupId.TabIndex = 19;
            btnItemLookupId.Text = "Lookup Id";
            btnItemLookupId.UseVisualStyleBackColor = true;
            btnItemLookupId.Click += btnItemLookupId_Click;
            // 
            // editItemLookupId
            // 
            editItemLookupId.Location = new System.Drawing.Point(114, 14);
            editItemLookupId.Maximum = new decimal(new int[] { -1530494977, 232830, 0, 0 });
            editItemLookupId.Name = "editItemLookupId";
            editItemLookupId.Size = new System.Drawing.Size(110, 23);
            editItemLookupId.TabIndex = 18;
            editItemLookupId.Value = new decimal(new int[] { 477351328, 0, 0, 0 });
            // 
            // lblItemLookupId
            // 
            lblItemLookupId.AutoSize = true;
            lblItemLookupId.Location = new System.Drawing.Point(11, 18);
            lblItemLookupId.Name = "lblItemLookupId";
            lblItemLookupId.Size = new System.Drawing.Size(80, 15);
            lblItemLookupId.TabIndex = 17;
            lblItemLookupId.Text = "Lookup by ID:";
            // 
            // progress
            // 
            progress.Location = new System.Drawing.Point(103, 474);
            progress.Name = "progress";
            progress.Size = new System.Drawing.Size(367, 23);
            progress.TabIndex = 100;
            progress.Visible = false;
            // 
            // MainForm
            // 
            AutoScaleDimensions = new System.Drawing.SizeF(7F, 15F);
            AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            ClientSize = new System.Drawing.Size(984, 761);
            Controls.Add(progress);
            Controls.Add(grpLookups);
            Controls.Add(lblFirstStep);
            Controls.Add(lblLog);
            Controls.Add(grpDetails);
            Controls.Add(grpProps);
            Controls.Add(memoLog);
            Controls.Add(btnTest);
            Controls.Add(lblQueueing);
            Controls.Add(txtQueueing);
            MinimumSize = new System.Drawing.Size(1000, 600);
            Name = "MainForm";
            Text = "Item Export";
            grpProps.ResumeLayout(false);
            propsPanel.ResumeLayout(false);
            propsPanel.PerformLayout();
            grpDetails.ResumeLayout(false);
            panel1.ResumeLayout(false);
            panel1.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)numTierMax).EndInit();
            ((System.ComponentModel.ISupportInitialize)numTierMin).EndInit();
            ((System.ComponentModel.ISupportInitialize)numRecipesTimeMax).EndInit();
            ((System.ComponentModel.ISupportInitialize)numRecipesLimit).EndInit();
            grpLookups.ResumeLayout(false);
            panel2.ResumeLayout(false);
            panel2.PerformLayout();
            ((System.ComponentModel.ISupportInitialize)editItemLookupId).EndInit();
            ResumeLayout(false);
            PerformLayout();
        }

        private System.Windows.Forms.TextBox txtQueueing;
        private System.Windows.Forms.Label lblQueueing;
        private System.Windows.Forms.Button btnTest;
        private System.Windows.Forms.TextBox memoLog;
        private System.Windows.Forms.GroupBox grpProps;
        private System.Windows.Forms.Panel propsPanel;
        private System.Windows.Forms.CheckBox chkPropRequiredTalentsForUse;
        private System.Windows.Forms.CheckBox chkPropHitpoints;
        private System.Windows.Forms.CheckBox chkPropSubdescription;
        private System.Windows.Forms.CheckBox chkPropScale;
        private System.Windows.Forms.CheckBox chkPropLevel;
        private System.Windows.Forms.CheckBox chkPropUnitMass;
        private System.Windows.Forms.CheckBox chkPropUnitVolume;
        private System.Windows.Forms.CheckBox chkPropDisplayName;
        private System.Windows.Forms.GroupBox grpDetails;
        private System.Windows.Forms.Panel panel1;
        private System.Windows.Forms.NumericUpDown numRecipesLimit;
        private System.Windows.Forms.Label lblRecipesLimit;
        private System.Windows.Forms.NumericUpDown numRecipesTimeMax;
        private System.Windows.Forms.Label lblRecipesTimeMax;
        private System.Windows.Forms.Label lblTierMin;
        private System.Windows.Forms.NumericUpDown numTierMin;
        private System.Windows.Forms.Label lblTierMax;
        private System.Windows.Forms.NumericUpDown numTierMax;
        private System.Windows.Forms.ComboBox cmbMode;
        private System.Windows.Forms.Label lblSize;
        private System.Windows.Forms.CheckBox chkSizeXS;
        private System.Windows.Forms.CheckBox chkSizeS;
        private System.Windows.Forms.CheckBox chkSizeM;
        private System.Windows.Forms.CheckBox chkSizeL;
        private System.Windows.Forms.CheckBox chkSizeXL;
        private System.Windows.Forms.CheckBox chkSizeXXL;
        private System.Windows.Forms.CheckBox chkSizeXXXL;
        private System.Windows.Forms.CheckBox chkRecipesNanocraftable;
        private System.Windows.Forms.CheckBox chkExportSchematics;
        private System.Windows.Forms.CheckBox chkExportTalents;
        private System.Windows.Forms.CheckBox chkExportTalentsJson;
        private System.Windows.Forms.CheckBox chkExportSchematicsJson;
        private System.Windows.Forms.Label lblOutYaml;
        private System.Windows.Forms.TextBox txtOutYaml;
        private System.Windows.Forms.Label lblOutJson;
        private System.Windows.Forms.TextBox txtOutJson;
        private System.Windows.Forms.CheckBox chkExportYaml;
        private System.Windows.Forms.CheckBox chkRecipesTransform;
        private System.Windows.Forms.Button btnExport;
        private System.Windows.Forms.Label lblLog;
        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.Label lblFirstStep;
        private System.Windows.Forms.GroupBox grpLookups;
        private System.Windows.Forms.Panel panel2;
        private System.Windows.Forms.Button btnItemLookupName;
        private System.Windows.Forms.TextBox editItemLookupName;
        private System.Windows.Forms.Label lblItemLookupName;
        private System.Windows.Forms.Button btnItemLookupId;
        private System.Windows.Forms.NumericUpDown editItemLookupId;
        private System.Windows.Forms.Label lblItemLookupId;
        private System.Windows.Forms.Label label2;
        private System.Windows.Forms.ProgressBar progress;
        private System.Windows.Forms.CheckBox chkLangEn;
        private System.Windows.Forms.Label lblExportSchematics;
        private System.Windows.Forms.Label lblExportTalents;
        private System.Windows.Forms.CheckBox chkAutoOverwrite;
        private System.Windows.Forms.Button btnMakeRecipeItems;
    }
}
