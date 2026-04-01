"""Transform dental-core responses to hub admin frontend schema."""


def _dc_status_to_controller(status: str, awaiting_operator: bool, is_chat: bool) -> str:
    """Map dental-core display status to hub controller value."""
    if awaiting_operator:
        return "operator"
    closed = {"confirmed", "cancelled", "chat_completed", "expired", "unreachable"}
    if status in closed:
        return "closed"
    return "bot"


def _dc_author_type_to_role(author_type: str) -> str:
    """Map dental-core author_type to hub role."""
    # DC: "patient" | "agent" | "admin"
    # Hub: "patient" | "agent" | "operator"
    if author_type == "admin":
        return "operator"
    return author_type


def transform_message(msg: dict) -> dict:
    """DC ChatMessage → Hub AdminMessage."""
    return {
        "id": str(msg["id"]),
        "role": _dc_author_type_to_role(msg.get("author_type", "agent")),
        "content": msg.get("text", ""),
        "metadata": None,
        "created_at": msg.get("timestamp", ""),
    }


def transform_session_detail(dc: dict, clinic_id: str) -> dict:
    """DC ConversationDetail → Hub AdminSessionDetail."""
    status = dc.get("status", "")
    awaiting = dc.get("awaiting_operator", False)
    is_chat = dc.get("is_chat", False)

    appts = dc.get("appointments", [])
    first_appt = appts[0] if appts else {}

    return {
        "id": str(dc["id"]),
        "clinic_id": clinic_id,
        "channel": "telegram",
        "thread_id": "",
        "controller": _dc_status_to_controller(status, awaiting, is_chat),
        "operator_id": None,
        "cooldown_until": None,
        "confirmation_status": status if not is_chat else None,
        "confirmation_appointment_id": str(first_appt["id"]) if first_appt.get("id") else None,
        "confirmation_appointment_date": first_appt.get("visit_datetime"),
        "confirmation_doctor_name": first_appt.get("doctor_name"),
        "crm_sync_status": None,
        "crm_sync_error": None,
        "created_at": None,
        "updated_at": None,
        "patient": {
            "id": None,
            "name": dc.get("patient_name") or None,
            "phone": dc.get("patient_phone") or None,
            "ident_patient_id": None,
        },
        "messages": [transform_message(m) for m in dc.get("messages", [])],
        "has_more_messages": False,
    }


def transform_session_summary(dc: dict) -> dict:
    """DC ConversationSummary → Hub AdminSessionSummary."""
    status = dc.get("status", "")
    awaiting = dc.get("awaiting_operator", False)
    is_chat = dc.get("is_chat", False)

    return {
        "id": str(dc["id"]),
        "channel": "telegram",
        "thread_id": "",
        "controller": _dc_status_to_controller(status, awaiting, is_chat),
        "confirmation_status": status if not is_chat else None,
        "crm_sync_status": None,
        "updated_at": dc.get("last_message_time"),
        "created_at": None,
        "patient": {
            "id": None,
            "name": dc.get("patient_name") or None,
            "phone": dc.get("patient_phone") or None,
        },
        "last_message": dc.get("last_message"),
        "last_message_at": dc.get("last_message_time"),
    }


def transform_sessions_list(dc_response: dict) -> list[dict]:
    """DC paginated conversations → Hub AdminSessionSummary[]."""
    items = dc_response.get("items", [])
    return [transform_session_summary(item) for item in items]


def transform_send_message_response(dc: dict) -> dict:
    """DC send message response → Hub AdminSendMessageResponse."""
    msg = dc.get("message", {})
    return {
        "success": True,
        "message_id": str(msg.get("id", "")),
        "delivered": True,
    }
