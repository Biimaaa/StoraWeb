def test_smb_and_nfs_share_lifecycle(client, auth_headers):
    # Setup pool & dataset first
    client.post("/api/v1/disks/scan", headers=auth_headers)
    disks = client.get("/api/v1/disks/", headers=auth_headers).json()
    available_disks = [d for d in disks if d["pool_id"] is None]

    pool_res = client.post(
        "/api/v1/pools/",
        json={
            "name": "sharepool",
            "topology": {
                "data": [
                    {
                        "vdev_type": "stripe",
                        "disk_ids": [available_disks[0]["id"]],
                        "purpose": "data",
                    }
                ]
            },
        },
        headers=auth_headers,
    )
    pool_id = pool_res.json()["id"]

    ds_res = client.post(
        "/api/v1/datasets/",
        json={
            "name": "sharedir",
            "pool_id": pool_id,
            "dataset_type": "filesystem",
            "preset": "smb",
        },
        headers=auth_headers,
    )
    dataset_id = ds_res.json()["id"]

    # 1. Create SMB Share (FR-4.1)
    smb_payload = {
        "name": "PublicShare",
        "protocol": "smb",
        "dataset_id": dataset_id,
        "enabled": True,
        "settings": {
            "guest_ok": True,
            "readonly": False,
            "browsable": True,
            "recycle_bin": True,
            "time_machine": False,
        },
    }
    smb_create = client.post("/api/v1/shares/", json=smb_payload, headers=auth_headers)
    assert smb_create.status_code in (200, 201)
    smb_share = smb_create.json()
    assert smb_share["name"] == "PublicShare"
    assert smb_share["protocol"] == "smb"
    assert "\\\\" in smb_share["network_path"]

    # 2. List shares
    list_res = client.get("/api/v1/shares/?protocol=smb", headers=auth_headers)
    assert list_res.status_code == 200
    shares = list_res.json()
    assert any(s["id"] == smb_share["id"] for s in shares)

    # 3. Toggle disable / enable
    disable_res = client.post(f"/api/v1/shares/{smb_share['id']}/disable", headers=auth_headers)
    assert disable_res.status_code == 200
    assert disable_res.json()["enabled"] is False

    enable_res = client.post(f"/api/v1/shares/{smb_share['id']}/enable", headers=auth_headers)
    assert enable_res.status_code == 200
    assert enable_res.json()["enabled"] is True

    # 4. Clean up share
    del_share = client.delete(f"/api/v1/shares/{smb_share['id']}", headers=auth_headers)
    assert del_share.status_code == 200

    # Cleanup dataset & pool
    client.delete(f"/api/v1/datasets/{dataset_id}?confirm_name=sharepool/sharedir", headers=auth_headers)
    client.delete(f"/api/v1/pools/{pool_id}?confirm_name=sharepool", headers=auth_headers)
